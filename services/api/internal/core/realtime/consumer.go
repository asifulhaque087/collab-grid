package realtime

import (
	"context"
	"log/slog"
)

// WidgetPersistenceConsumer consumes durable widget-position messages and writes
// the new coordinates to Postgres, board-scoped so a stray widgetId can't update
// another board's row.
type WidgetPersistenceConsumer struct {
	rabbit *RabbitmqService
	repo   RealtimeRepo
	logger *slog.Logger
}

func NewWidgetPersistenceConsumer(rabbit *RabbitmqService, repo RealtimeRepo, logger *slog.Logger) *WidgetPersistenceConsumer {
	return &WidgetPersistenceConsumer{rabbit: rabbit, repo: repo, logger: logger}
}

func (c *WidgetPersistenceConsumer) Start(ctx context.Context) {
	c.rabbit.Consume(ctx, func(ctx context.Context, msg WidgetPositionMessage) error {
		bid, err := parseUUID(msg.BoardID)
		if err != nil {
			c.logger.Warn("invalid board id in position message", "board_id", msg.BoardID)
			return nil // drop poison message
		}
		wid, err := parseUUID(msg.WidgetID)
		if err != nil {
			c.logger.Warn("invalid widget id in position message", "widget_id", msg.WidgetID)
			return nil
		}
		if _, err := c.repo.UpdateWidgetPosition(ctx, updatePosParams(bid, wid, msg.X, msg.Y)); err != nil {
			c.logger.Error("failed to persist widget position", "error", err)
			return err
		}
		return nil
	})
}
