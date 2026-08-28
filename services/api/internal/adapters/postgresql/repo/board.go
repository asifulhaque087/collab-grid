package repo

import (
	"context"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/loot-board/services/api/internal/service/boards"
	"github.com/jackc/pgx/v5/pgtype"
)

type BoardRepository struct {
	queries *sqlc.Queries
}

func NewBoardRepository(db sqlc.DBTX) *BoardRepository {
	return &BoardRepository{
		queries: sqlc.New(db),
	}
}

func (r *BoardRepository) ListBoardsByPrimaryUserId(ctx context.Context, primaryUserID pgtype.UUID) ([]boards.Board, error) {
	rows, err := r.queries.ListBoardsByPrimaryUserId(ctx, primaryUserID)
	if err != nil {
		return nil, err
	}
	res := make([]boards.Board, len(rows))
	for i, row := range rows {
		res[i] = toBoard(row.ID, row.PrimaryUserID, row.SecondaryUserID, row.Name, row.Slug, row.Access, row.MaxWidth, row.MaxHeight, row.CreatedAt, row.UpdatedAt, row.WidgetCount)
	}
	return res, nil
}

func (r *BoardRepository) GetBoardById(ctx context.Context, arg boards.GetBoardByIdParams) (boards.Board, error) {
	row, err := r.queries.GetBoardById(ctx, sqlc.GetBoardByIdParams{
		ID:            arg.ID,
		PrimaryUserID: arg.PrimaryUserID,
	})
	if err != nil {
		return boards.Board{}, err
	}
	return toBoard(row.ID, row.PrimaryUserID, row.SecondaryUserID, row.Name, row.Slug, row.Access, row.MaxWidth, row.MaxHeight, row.CreatedAt, row.UpdatedAt, row.WidgetCount), nil
}

func (r *BoardRepository) GetBoardBySlug(ctx context.Context, arg boards.GetBoardBySlugParams) (boards.Board, error) {
	row, err := r.queries.GetBoardBySlug(ctx, sqlc.GetBoardBySlugParams{
		Slug:          arg.Slug,
		PrimaryUserID: arg.PrimaryUserID,
	})
	if err != nil {
		return boards.Board{}, err
	}
	return toBoard(row.ID, row.PrimaryUserID, row.SecondaryUserID, row.Name, row.Slug, row.Access, row.MaxWidth, row.MaxHeight, row.CreatedAt, row.UpdatedAt, row.WidgetCount), nil
}

func (r *BoardRepository) GetPublicBoardBySlug(ctx context.Context, slug string) (boards.Board, error) {
	row, err := r.queries.GetPublicBoardBySlug(ctx, slug)
	if err != nil {
		return boards.Board{}, err
	}
	return toBoard(row.ID, row.PrimaryUserID, row.SecondaryUserID, row.Name, row.Slug, row.Access, row.MaxWidth, row.MaxHeight, row.CreatedAt, row.UpdatedAt, row.WidgetCount), nil
}

func (r *BoardRepository) GetBoardIdBySlug(ctx context.Context, slug string) (pgtype.UUID, error) {
	return r.queries.GetBoardIdBySlug(ctx, slug)
}

func (r *BoardRepository) CreateBoard(ctx context.Context, arg boards.CreateBoardParams) (boards.Board, error) {
	board, err := r.queries.CreateBoard(ctx, sqlc.CreateBoardParams{
		PrimaryUserID:   arg.PrimaryUserID,
		SecondaryUserID: arg.SecondaryUserID,
		Name:            arg.Name,
		Slug:            arg.Slug,
		Access:          arg.Access,
		MaxWidth:        arg.MaxWidth,
		MaxHeight:       arg.MaxHeight,
	})
	if err != nil {
		return boards.Board{}, err
	}
	return toBoard(board.ID, board.PrimaryUserID, board.SecondaryUserID, board.Name, board.Slug, board.Access, board.MaxWidth, board.MaxHeight, board.CreatedAt, board.UpdatedAt, 0), nil
}

func (r *BoardRepository) UpdateBoard(ctx context.Context, arg boards.UpdateBoardParams) (boards.Board, error) {
	board, err := r.queries.UpdateBoard(ctx, sqlc.UpdateBoardParams{
		ID:        arg.ID,
		Name:      arg.Name,
		Access:    arg.Access,
		MaxWidth:  arg.MaxWidth,
		MaxHeight: arg.MaxHeight,
	})
	if err != nil {
		return boards.Board{}, err
	}
	return toBoard(board.ID, board.PrimaryUserID, board.SecondaryUserID, board.Name, board.Slug, board.Access, board.MaxWidth, board.MaxHeight, board.CreatedAt, board.UpdatedAt, 0), nil
}

func (r *BoardRepository) DeleteBoard(ctx context.Context, id pgtype.UUID) error {
	return r.queries.DeleteBoard(ctx, id)
}

func toBoard(
	id pgtype.UUID,
	primaryUserID pgtype.UUID,
	secondaryUserID pgtype.UUID,
	name string,
	slug string,
	access string,
	maxWidth pgtype.Int4,
	maxHeight pgtype.Int4,
	createdAt pgtype.Timestamp,
	updatedAt pgtype.Timestamp,
	widgetCount int64,
) boards.Board {
	return boards.Board{
		ID:              id,
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
		Name:            name,
		Slug:            slug,
		Access:          access,
		MaxWidth:        maxWidth,
		MaxHeight:       maxHeight,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
		WidgetCount:     widgetCount,
	}
}
