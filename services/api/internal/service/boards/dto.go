package boards

import "time"

type CreateBoardRequestDto struct {
	Name      string `json:"name" validate:"required"`
	Access    string `json:"access" validate:"required,oneof=restricted public"`
	MaxWidth  *int32 `json:"maxWidth,omitempty" validate:"omitempty,min=1"`
	MaxHeight *int32 `json:"maxHeight,omitempty" validate:"omitempty,min=1"`
}

type UpdateBoardRequestDto struct {
	Name      *string `json:"name,omitempty" validate:"omitempty,min=1"`
	Access    *string `json:"access,omitempty" validate:"omitempty,oneof=restricted public"`
	MaxWidth  *int32  `json:"maxWidth,omitempty" validate:"omitempty,min=1"`
	MaxHeight *int32  `json:"maxHeight,omitempty" validate:"omitempty,min=1"`
}

type BoardResponseDto struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Access      string    `json:"access"`
	MaxWidth    *int32    `json:"maxWidth"`
	MaxHeight   *int32    `json:"maxHeight"`
	CreatedAt   time.Time `json:"createdAt"`
	WidgetCount int64     `json:"widgetCount"`
}
