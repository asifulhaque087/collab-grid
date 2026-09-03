package order

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Order struct {
	ID            pgtype.UUID
	BoardID       pgtype.UUID
	BuyerUserID   pgtype.Text
	BuyerName     pgtype.Text
	Email         pgtype.Text
	Phone         pgtype.Text
	Address       string
	City          pgtype.Text
	PostalCode    pgtype.Text
	Country       pgtype.Text
	AmountTotal   string
	PaymentMethod string
	CardLast4     pgtype.Text
	Status        string
	CreatedAt     time.Time
}

type OrderItem struct {
	ID       pgtype.UUID
	Name     string
	Sku      string
	Price    string
	Quantity int32
}

type OrderWithItems struct {
	Order
	BoardName string
	Items     []OrderItem
}

type WidgetLine struct {
	ID       pgtype.UUID
	Name     string
	Sku      string
	Price    string
	Quantity int32
}

type CreateOrderParams struct {
	IdempotencyKey string
	BoardID        pgtype.UUID
	BuyerUserID    pgtype.Text
	BuyerName      pgtype.Text
	Email          pgtype.Text
	Phone          pgtype.Text
	Address        string
	City           pgtype.Text
	PostalCode     pgtype.Text
	Country        pgtype.Text
	AmountTotal    string
	PaymentMethod  string
	CardLast4      pgtype.Text
	Status         string
}

type CreateOrderItem struct {
	WidgetID pgtype.UUID
	Name     string
	Sku      string
	Price    string
	Quantity int32
}
