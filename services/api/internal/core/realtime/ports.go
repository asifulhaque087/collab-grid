package realtime

import (
	"context"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

// RealtimeRepo is the persistence surface the realtime service depends on.
// Implemented by the postgresql repo adapter.
type RealtimeRepo interface {
	GetBoardBySlug(ctx context.Context, slug string) (sqlc.GetRealtimeBoardBySlugRow, error)
	GetPlacedWidgets(ctx context.Context, boardID pgtype.UUID) ([]sqlc.GetPlacedWidgetsRow, error)
	UpdateWidgetPosition(ctx context.Context, arg sqlc.UpdateWidgetPositionParams) (sqlc.UpdateWidgetPositionRow, error)
	RemoveWidget(ctx context.Context, arg sqlc.RemoveWidgetParams) error
	GetUserWidgetPermissions(ctx context.Context, userID pgtype.UUID) ([]sqlc.GetUserWidgetPermissionsRow, error)
}

// Emitter broadcasts to connected sockets. Implemented by *Hub.
type Emitter interface {
	EmitToRoom(room, event string, payload any)
	EmitToRoomExcept(room, event string, payload any, except *Client)
	EmitToClient(c *Client, event string, payload any)
}

// Service is the public-facing capability set (also consumed by the order flow
// to complete a purchase).
type Service interface {
	GetRealtimeBoardBySlug(ctx context.Context, slug string) (*BoardJoinBoard, error)
	GetBoardWidgets(ctx context.Context, boardID string) ([]CanvasWidgetDto, error)
	PlaceWidget(ctx context.Context, boardID, widgetID string, x, y float64) (*CanvasWidgetDto, error)
	SaveWidgetPosition(ctx context.Context, boardID, widgetID string, x, y float64) error
	AcquireSoftLock(ctx context.Context, boardID, widgetID, userID string) (SoftLockResult, error)
	ReleaseLock(ctx context.Context, boardID, widgetID, userID string) error
	ReleaseAllUserLocks(ctx context.Context, boardID, userID string) ([]string, error)
	PromoteToHardLocks(ctx context.Context, boardID, userID string) ([]string, error)
	MarkPaid(ctx context.Context, boardID, widgetID string) error
	ResolveExpiredLock(ctx context.Context, boardID, widgetID string) (string, error)
	RemoveWidget(ctx context.Context, boardID, widgetID string) error
	GetUserLocks(ctx context.Context, boardID, userID string) ([]WidgetLock, error)
	ClearLock(ctx context.Context, boardID, widgetID string) error
	CanManageWidgets(ctx context.Context, userID string) (bool, error)
	// UserHoldsLock + CompletePurchase satisfy the order package's RealtimeGateway
	// contract so the order flow can drive realtime state transitions.
	UserHoldsLock(ctx context.Context, boardID pgtype.UUID, widgetID pgtype.UUID, buyerUserID string) bool
	CompletePurchase(ctx context.Context, boardID pgtype.UUID, widgetIDs []pgtype.UUID, buyerUserID string) error
}

// BoardJoinBoard is a slim board projection used during join.
type BoardJoinBoard struct {
	ID        string
	Slug      string
	Name      string
	Access    string
	MaxWidth  int32
	MaxHeight int32
}

// SoftLockResult mirrors the TS union return of acquireSoftLock.
type SoftLockResult struct {
	OK     bool
	Reason string // "taken" | "bot"
	Holder string
	Lock   *WidgetLock
}

var (
	_ Service = (*service)(nil)
	_ Emitter = (*Hub)(nil)
)
