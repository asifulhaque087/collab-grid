package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const WIDGET_POSITION_QUEUE = "widget.position"

// WidgetPositionMessage is a persisted widget reposition. The gateway publishes
// these (debounced during a drag, immediately on drag-end); the consumer writes
// posX/posY to Postgres.
type WidgetPositionMessage struct {
	BoardID  string  `json:"boardId"`
	WidgetID string  `json:"widgetId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

type WidgetPositionHandler func(ctx context.Context, msg WidgetPositionMessage) error

// RabbitmqService is a thin amqplib-style wrapper. The connection is lazy and
// failure-tolerant: if RabbitMQ is unreachable the realtime broadcasts still
// happen, only the durable persistence is skipped — the canvas stays live.
type RabbitmqService struct {
	url     string
	logger  *slog.Logger
	mu      sync.Mutex
	conn    *amqp.Connection
	channel *amqp.Channel
	// debounce collapses a fast drag into one persisted write per widget.
	debounce map[string]*time.Timer
}

func NewRabbitmqService(url string, logger *slog.Logger) *RabbitmqService {
	return &RabbitmqService{
		url:      url,
		logger:   logger,
		debounce: make(map[string]*time.Timer),
	}
}

func (r *RabbitmqService) Connect() {
	if r.url == "" {
		r.logger.Warn("RABBITMQ_URL not set — position persistence disabled")
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.conn != nil {
		return
	}
	conn, err := amqp.Dial(r.url)
	if err != nil {
		r.logger.Warn("RabbitMQ connection failed; retrying lazily", "error", err.Error())
		return
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		r.logger.Warn("RabbitMQ channel failed; retrying lazily", "error", err.Error())
		return
	}
	if err := ch.Confirm(false); err != nil {
		r.logger.Warn("RabbitMQ confirm mode failed", "error", err.Error())
	}
	if _, err := ch.QueueDeclare(WIDGET_POSITION_QUEUE, true, false, false, false, nil); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		r.logger.Warn("RabbitMQ queue declare failed; retrying lazily", "error", err.Error())
		return
	}
	r.conn = conn
	r.channel = ch
	closeCh := make(chan *amqp.Error, 1)
	conn.NotifyClose(closeCh)
	go func() {
		<-closeCh
		r.mu.Lock()
		r.conn = nil
		r.channel = nil
		r.mu.Unlock()
	}()
}

func (r *RabbitmqService) ensureChannel() *amqp.Channel {
	r.mu.Lock()
	if r.channel == nil {
		r.mu.Unlock()
		r.Connect()
		r.mu.Lock()
	}
	ch := r.channel
	r.mu.Unlock()
	return ch
}

// Publish is an immediate, debounce-flushing publish — used on widget:move:end.
func (r *RabbitmqService) Publish(ctx context.Context, msg WidgetPositionMessage) {
	r.mu.Lock()
	if t, ok := r.debounce[msg.WidgetID]; ok {
		t.Stop()
		delete(r.debounce, msg.WidgetID)
	}
	r.mu.Unlock()
	_ = r.send(ctx, msg)
}

// PublishDebounced coalesces rapid moves of the same widget into a single delayed
// publish.
func (r *RabbitmqService) PublishDebounced(ctx context.Context, msg WidgetPositionMessage, delayMs int) {
	if delayMs <= 0 {
		delayMs = 400
	}
	r.mu.Lock()
	if t, ok := r.debounce[msg.WidgetID]; ok {
		t.Stop()
	}
	r.debounce[msg.WidgetID] = time.AfterFunc(time.Duration(delayMs)*time.Millisecond, func() {
		r.mu.Lock()
		delete(r.debounce, msg.WidgetID)
		r.mu.Unlock()
		_ = r.send(ctx, msg)
	})
	r.mu.Unlock()
}

func (r *RabbitmqService) send(ctx context.Context, msg WidgetPositionMessage) error {
	ch := r.ensureChannel()
	if ch == nil {
		return nil
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return ch.PublishWithContext(ctx, "", WIDGET_POSITION_QUEUE, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}

// Consume registers the durable consumer that persists positions.
func (r *RabbitmqService) Consume(ctx context.Context, handler WidgetPositionHandler) {
	ch := r.ensureChannel()
	if ch == nil {
		r.logger.Warn("No channel — widget position consumer not started")
		return
	}
	deliveries, err := ch.ConsumeWithContext(ctx, WIDGET_POSITION_QUEUE, "widget-position-consumer", false, false, false, false, nil)
	if err != nil {
		r.logger.Warn("RabbitMQ consume failed", "error", err.Error())
		return
	}
	go func() {
		for raw := range deliveries {
			var msg WidgetPositionMessage
			if err := json.Unmarshal(raw.Body, &msg); err != nil {
				_ = raw.Nack(false, false)
				continue
			}
			if err := handler(ctx, msg); err != nil {
				// Drop the message on failure (don't requeue a poison position write).
				_ = raw.Nack(false, false)
				continue
			}
			_ = raw.Ack(false)
		}
	}()
}

func (r *RabbitmqService) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, t := range r.debounce {
		t.Stop()
	}
	r.debounce = make(map[string]*time.Timer)
	if r.channel != nil {
		_ = r.channel.Close()
	}
	if r.conn != nil {
		_ = r.conn.Close()
	}
	r.channel = nil
	r.conn = nil
}
