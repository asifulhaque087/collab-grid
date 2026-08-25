package order

import "time"

type CreateOrderRequestDto struct {
	IdempotencyKey string   `json:"idempotencyKey" validate:"required"`
	BoardID        string   `json:"boardId" validate:"required,uuid"`
	WidgetIds      []string `json:"widgetIds" validate:"required,min=1,dive,uuid"`
	BuyerUserId    *string  `json:"buyerUserId,omitempty"`
	BuyerName      *string  `json:"buyerName,omitempty"`
	Email          *string  `json:"email,omitempty" validate:"omitempty,email"`
	Phone          *string  `json:"phone,omitempty"`
	Address        string   `json:"address" validate:"required"`
	City           *string  `json:"city,omitempty"`
	PostalCode     *string  `json:"postalCode,omitempty"`
	Country        *string  `json:"country,omitempty"`
	CardLast4      *string  `json:"cardLast4,omitempty"`
}

type CreateOrderResponseDto struct {
	OrderID   string `json:"orderId"`
	Duplicate bool   `json:"duplicate"`
}

type OrderItemDto struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Sku      string `json:"sku"`
	Price    string `json:"price"`
	Quantity int32  `json:"quantity"`
}

type OrderResponseDto struct {
	ID            string         `json:"id"`
	BuyerName     *string        `json:"buyerName"`
	Email         *string        `json:"email"`
	AmountTotal   string         `json:"amountTotal"`
	PaymentMethod string         `json:"paymentMethod"`
	CardLast4     *string        `json:"cardLast4"`
	Status        string         `json:"status"`
	CreatedAt     time.Time      `json:"createdAt"`
	BoardID       *string        `json:"boardId"`
	BoardName     *string        `json:"boardName"`
	Items         []OrderItemDto `json:"items"`
}
