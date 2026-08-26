package repo

import (
	"context"

	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

// RealtimeRepository implements the realtime.RealtimeRepo interface against sqlc.
type RealtimeRepository struct {
	queries *sqlc.Queries
}

func NewRealtimeRepository(db sqlc.DBTX) *RealtimeRepository {
	return &RealtimeRepository{queries: sqlc.New(db)}
}

func (r *RealtimeRepository) GetBoardBySlug(ctx context.Context, slug string) (sqlc.GetRealtimeBoardBySlugRow, error) {
	return r.queries.GetRealtimeBoardBySlug(ctx, slug)
}

func (r *RealtimeRepository) GetPlacedWidgets(ctx context.Context, boardID pgtype.UUID) ([]sqlc.GetPlacedWidgetsRow, error) {
	return r.queries.GetPlacedWidgets(ctx, boardID)
}

func (r *RealtimeRepository) UpdateWidgetPosition(ctx context.Context, arg sqlc.UpdateWidgetPositionParams) (sqlc.UpdateWidgetPositionRow, error) {
	return r.queries.UpdateWidgetPosition(ctx, arg)
}

func (r *RealtimeRepository) RemoveWidget(ctx context.Context, arg sqlc.RemoveWidgetParams) error {
	return r.queries.RemoveWidget(ctx, arg)
}

func (r *RealtimeRepository) GetUserWidgetPermissions(ctx context.Context, userID pgtype.UUID) ([]sqlc.GetUserWidgetPermissionsRow, error) {
	return r.queries.GetUserWidgetPermissions(ctx, userID)
}
