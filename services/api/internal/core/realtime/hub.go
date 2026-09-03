package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

// Client is a single websocket connection participating in one (or zero) boards.
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	user     CanvasUser
	socketID string
	boardID  string
	zones    map[string]bool
	canMove  bool
	// wsUserID is set from a valid WS exchange token at connect time.
	wsUserID string
}

func (c *Client) write(data []byte) {
	select {
	case c.send <- data:
	default:
		// Buffer full — drop the frame rather than block the broadcaster.
	}
}

// Hub fans out server → client messages. Clients join board-wide and zone rooms;
// broadcasts are scoped to a room so only relevant sockets receive an event.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]bool
	rooms   map[string]map[*Client]bool

	rdb        *redis.Client
	logger     *slog.Logger
	instanceID string
	backplane  bool
}

func NewHub(rdb *redis.Client, logger *slog.Logger) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		rdb:        rdb,
		logger:     logger,
		instanceID: uuid.NewString(),
	}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		for room, set := range h.rooms {
			delete(set, c)
			if len(set) == 0 {
				delete(h.rooms, room)
			}
		}
	}
	h.mu.Unlock()
	close(c.send)
}

func (h *Hub) JoinRoom(c *Client, room string) {
	h.mu.Lock()
	if h.rooms[room] == nil {
		h.rooms[room] = make(map[*Client]bool)
	}
	h.rooms[room][c] = true
	h.mu.Unlock()
}

func (h *Hub) LeaveRoom(c *Client, room string) {
	h.mu.Lock()
	if set := h.rooms[room]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.rooms, room)
		}
	}
	h.mu.Unlock()
}

func (h *Hub) deliverLocal(room string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[room] {
		c.write(data)
	}
}

func (h *Hub) deliverLocalExcept(room string, data []byte, except *Client) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[room] {
		if c == except {
			continue
		}
		c.write(data)
	}
}

func marshalEnvelope(event string, payload any) []byte {
	b, _ := json.Marshal(outboundMessage{Type: event, Payload: payload})
	return b
}

// EmitToRoom broadcasts to every socket in a room and — when a Redis backplane is
// active — republishes so other instances deliver to their local members too.
func (h *Hub) EmitToRoom(room, event string, payload any) {
	data := marshalEnvelope(event, payload)
	h.deliverLocal(room, data)
	h.publish(room, event, payload)
}

func (h *Hub) EmitToRoomExcept(room, event string, payload any, except *Client) {
	data := marshalEnvelope(event, payload)
	h.deliverLocalExcept(room, data, except)
	h.publish(room, event, payload)
}

func (h *Hub) EmitToClient(c *Client, event string, payload any) {
	c.write(marshalEnvelope(event, payload))
}

type roomMessage struct {
	InstanceID string          `json:"instanceId"`
	Room       string          `json:"room"`
	Event      string          `json:"event"`
	Payload    json.RawMessage `json:"payload"`
}

func (h *Hub) publish(room, event string, payload any) {
	if h.rdb == nil || !h.backplane {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	msg := roomMessage{InstanceID: h.instanceID, Room: room, Event: event, Payload: raw}
	b, _ := json.Marshal(msg)
	if err := h.rdb.Publish(context.Background(), "lootboard:rt", string(b)).Err(); err != nil {
		h.logger.Warn("redis backplane publish failed", "error", err.Error())
	}
}

// StartBackplane subscribes to the cross-instance channel so broadcasts from other
// nodes reach this node's locally-connected sockets. Degrades to in-memory only
// if Redis is unreachable.
func (h *Hub) StartBackplane(ctx context.Context) {
	if h.rdb == nil {
		return
	}
	pubsub := h.rdb.Subscribe(ctx, "lootboard:rt")
	if _, err := pubsub.Receive(ctx); err != nil {
		h.logger.Warn("redis backplane unavailable; running in single-instance mode", "error", err.Error())
		return
	}
	h.backplane = true
	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			var rm roomMessage
			if err := json.Unmarshal([]byte(msg.Payload), &rm); err != nil {
				continue
			}
			if rm.InstanceID == h.instanceID {
				continue
			}
			h.deliverLocal(rm.Room, marshalEnvelope(rm.Event, json.RawMessage(rm.Payload)))
		}
	}()
}
