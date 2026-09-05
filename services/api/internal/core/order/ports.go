package order

import (
	"context"

	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/mail/smtp/templates"
	"github.com/jackc/pgx/v5/pgtype"
)

type RealtimeGateway interface {
	UserHoldsLock(ctx context.Context, boardID pgtype.UUID, widgetID pgtype.UUID, buyerUserID string) bool
	CompletePurchase(ctx context.Context, boardID pgtype.UUID, widgetIDs []pgtype.UUID, buyerUserID string) error
}

type InvoiceMailer interface {
	SendOrderInvoiceEmail(to string, order templates.InvoiceOrder, items []templates.InvoiceItem) error
}

type OrderRepo interface {
	GetOrderIdByIdempotencyKey(ctx context.Context, idempotencyKey string) (pgtype.UUID, error)
	GetBoardIdById(ctx context.Context, id pgtype.UUID) (pgtype.UUID, error)
	ListWidgetsForOrder(ctx context.Context, boardID pgtype.UUID, widgetIDs []pgtype.UUID) ([]WidgetLine, error)
	CreateOrder(ctx context.Context, arg CreateOrderParams, items []CreateOrderItem) (Order, error)
	ListOrdersWithItemsByPrimaryUserID(ctx context.Context, primaryUserID pgtype.UUID) ([]OrderWithItems, error)
	GetOrderById(ctx context.Context, id pgtype.UUID) (OrderWithItems, error)
}

type InvoiceView struct {
	Order templates.InvoiceOrder
	Items []templates.InvoiceItem
}

type OrderService interface {
	Create(ctx context.Context, dto CreateOrderRequestDto) (*CreateOrderResponseDto, error)
	FindAll(ctx context.Context, userID string, parentID string) ([]OrderResponseDto, error)
	Invoice(ctx context.Context, id string) (*InvoiceView, error)
}
