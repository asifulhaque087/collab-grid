package inventory

import "time"

type CreateInventoryRequestDto struct {
	Name     string  `json:"name" validate:"required"`
	Sku      string  `json:"sku" validate:"required"`
	Quantity int32   `json:"quantity" validate:"min=0"`
	Price    *string `json:"price,omitempty" validate:"omitempty,numeric"`
	Photo    *string `json:"photo,omitempty"`
	BoardID  *string `json:"boardId,omitempty" validate:"omitempty,uuid"`
	Width    *int32  `json:"width,omitempty" validate:"omitempty,min=1"`
	Height   *int32  `json:"height,omitempty" validate:"omitempty,min=1"`
}

type UpdateInventoryRequestDto struct {
	Name     *string `json:"name,omitempty" validate:"omitempty,min=1"`
	Sku      *string `json:"sku,omitempty" validate:"omitempty,min=1"`
	Quantity *int32  `json:"quantity,omitempty" validate:"omitempty,min=0"`
	Price    *string `json:"price,omitempty" validate:"omitempty,numeric"`
	Photo    *string `json:"photo,omitempty"`
	BoardID  *string `json:"boardId,omitempty" validate:"omitempty,uuid"`
	Width    *int32  `json:"width,omitempty" validate:"omitempty,min=1"`
	Height   *int32  `json:"height,omitempty" validate:"omitempty,min=1"`
}

type InventoryResponseDto struct {
	ID        string    `json:"id"`
	Sku       string    `json:"sku"`
	Name      string    `json:"name"`
	Quantity  int32     `json:"quantity"`
	Price     *string   `json:"price"`
	Photo     *string   `json:"photo"`
	PosX      *string   `json:"posX"`
	PosY      *string   `json:"posY"`
	Width     int32     `json:"width"`
	Height    int32     `json:"height"`
	BoardID   *string   `json:"boardId"`
	BoardName *string   `json:"boardName"`
	CreatedAt time.Time `json:"createdAt"`
}

type ImportInventoryResponseDto struct {
	Imported int64 `json:"imported"`
}
