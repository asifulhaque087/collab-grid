package repo

import (
	"context"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/inventory"
	"github.com/jackc/pgx/v5/pgtype"
)

type InventoryRepository struct {
	queries *sqlc.Queries
}

func NewInventoryRepository(db sqlc.DBTX) *InventoryRepository {
	return &InventoryRepository{
		queries: sqlc.New(db),
	}
}

func (r *InventoryRepository) ListSmartWidgetsByPrimaryUserId(ctx context.Context, primaryUserID pgtype.UUID, boardID pgtype.UUID) ([]inventory.SmartWidget, error) {
	rows, err := r.queries.ListSmartWidgetsByPrimaryUserId(ctx, sqlc.ListSmartWidgetsByPrimaryUserIdParams{
		PrimaryUserID: primaryUserID,
		BoardID:       boardID,
	})
	if err != nil {
		return nil, err
	}
	res := make([]inventory.SmartWidget, len(rows))
	for i, row := range rows {
		res[i] = toSmartWidget(row.ID, row.PrimaryUserID, row.SecondaryUserID, row.BoardID, row.Sku, row.Photo, row.Quantity, row.Price, row.Name, row.PosX, row.PosY, row.Width, row.Height, row.CreatedAt, row.UpdatedAt, row.BoardName)
	}
	return res, nil
}

func (r *InventoryRepository) GetSmartWidgetById(ctx context.Context, arg inventory.GetSmartWidgetByIdParams) (inventory.SmartWidget, error) {
	row, err := r.queries.GetSmartWidgetById(ctx, sqlc.GetSmartWidgetByIdParams{
		ID:            arg.ID,
		PrimaryUserID: arg.PrimaryUserID,
	})
	if err != nil {
		return inventory.SmartWidget{}, err
	}
	return toSmartWidget(row.ID, row.PrimaryUserID, row.SecondaryUserID, row.BoardID, row.Sku, row.Photo, row.Quantity, row.Price, row.Name, row.PosX, row.PosY, row.Width, row.Height, row.CreatedAt, row.UpdatedAt, row.BoardName), nil
}

func (r *InventoryRepository) CreateSmartWidget(ctx context.Context, arg inventory.CreateSmartWidgetParams) (inventory.SmartWidget, error) {
	item, err := r.queries.CreateSmartWidget(ctx, sqlc.CreateSmartWidgetParams{
		PrimaryUserID:   arg.PrimaryUserID,
		SecondaryUserID: arg.SecondaryUserID,
		BoardID:         arg.BoardID,
		Name:            arg.Name,
		Sku:             arg.Sku,
		Quantity:        arg.Quantity,
		Price:           arg.Price,
		Photo:           arg.Photo,
		Width:           arg.Width,
		Height:          arg.Height,
	})
	if err != nil {
		return inventory.SmartWidget{}, err
	}
	return toSmartWidget(item.ID, item.PrimaryUserID, item.SecondaryUserID, item.BoardID, item.Sku, item.Photo, item.Quantity, item.Price, item.Name, item.PosX, item.PosY, item.Width, item.Height, item.CreatedAt, item.UpdatedAt, pgtype.Text{}), nil
}

func (r *InventoryRepository) UpdateSmartWidget(ctx context.Context, arg inventory.UpdateSmartWidgetParams) error {
	return r.queries.UpdateSmartWidget(ctx, sqlc.UpdateSmartWidgetParams{
		ID:       arg.ID,
		Name:     arg.Name,
		Sku:      arg.Sku,
		Quantity: arg.Quantity,
		Price:    arg.Price,
		Photo:    arg.Photo,
		BoardID:  arg.BoardID,
		Width:    arg.Width,
		Height:   arg.Height,
	})
}

func (r *InventoryRepository) DeleteSmartWidget(ctx context.Context, id pgtype.UUID) error {
	return r.queries.DeleteSmartWidget(ctx, id)
}

func (r *InventoryRepository) CreateSmartWidgets(ctx context.Context, items []inventory.CreateSmartWidgetParams) (int64, error) {
	rows := make([]sqlc.CreateSmartWidgetsParams, len(items))
	for i, item := range items {
		rows[i] = sqlc.CreateSmartWidgetsParams{
			PrimaryUserID:   item.PrimaryUserID,
			SecondaryUserID: item.SecondaryUserID,
			BoardID:         item.BoardID,
			Name:            item.Name,
			Sku:             item.Sku,
			Quantity:        item.Quantity,
			Price:           item.Price,
			Photo:           item.Photo,
			Width:           item.Width,
			Height:          item.Height,
		}
	}
	return r.queries.CreateSmartWidgets(ctx, rows)
}

func (r *InventoryRepository) GetBoardExistsForUser(ctx context.Context, boardID pgtype.UUID, primaryUserID pgtype.UUID) (bool, error) {
	return r.queries.GetBoardExistsForUser(ctx, sqlc.GetBoardExistsForUserParams{
		ID:            boardID,
		PrimaryUserID: primaryUserID,
	})
}

func toSmartWidget(
	id pgtype.UUID,
	primaryUserID pgtype.UUID,
	secondaryUserID pgtype.UUID,
	boardID pgtype.UUID,
	sku string,
	photo pgtype.Text,
	quantity int32,
	price pgtype.Numeric,
	name string,
	posX pgtype.Numeric,
	posY pgtype.Numeric,
	width int32,
	height int32,
	createdAt pgtype.Timestamp,
	updatedAt pgtype.Timestamp,
	boardName pgtype.Text,
) inventory.SmartWidget {
	return inventory.SmartWidget{
		ID:              id,
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
		BoardID:         boardID,
		Sku:             sku,
		Photo:           photo,
		Quantity:        quantity,
		Price:           price,
		Name:            name,
		PosX:            posX,
		PosY:            posY,
		Width:           width,
		Height:          height,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
		BoardName:       boardName,
	}
}
