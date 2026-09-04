package inventory

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// Service will use this
type InventoryRepo interface {
	ListSmartWidgetsByPrimaryUserId(ctx context.Context, primaryUserID pgtype.UUID, boardID pgtype.UUID) ([]SmartWidget, error)
	GetSmartWidgetById(ctx context.Context, arg GetSmartWidgetByIdParams) (SmartWidget, error)
	CreateSmartWidget(ctx context.Context, arg CreateSmartWidgetParams) (SmartWidget, error)
	UpdateSmartWidget(ctx context.Context, arg UpdateSmartWidgetParams) error
	DeleteSmartWidget(ctx context.Context, id pgtype.UUID) error
	CreateSmartWidgets(ctx context.Context, items []CreateSmartWidgetParams) (int64, error)
	GetBoardExistsForUser(ctx context.Context, boardID pgtype.UUID, primaryUserID pgtype.UUID) (bool, error)
}

// Handler will use this
type InventoryService interface {
	FindAll(ctx context.Context, userID string, parentID string, boardID *string) ([]InventoryResponseDto, error)
	Create(ctx context.Context, dto CreateInventoryRequestDto, userID string, parentID string) (*InventoryResponseDto, error)
	ImportCsv(ctx context.Context, content []byte, userID string, parentID string, boardID *string) (*ImportInventoryResponseDto, error)
	Update(ctx context.Context, id string, dto UpdateInventoryRequestDto, userID string, parentID string) (*InventoryResponseDto, error)
	Remove(ctx context.Context, id string, userID string, parentID string) error
}
