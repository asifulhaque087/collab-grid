package boards

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// Service will use this
type BoardRepo interface {
	ListBoardsByPrimaryUserId(ctx context.Context, primaryUserID pgtype.UUID) ([]Board, error)
	GetBoardById(ctx context.Context, arg GetBoardByIdParams) (Board, error)
	GetBoardBySlug(ctx context.Context, arg GetBoardBySlugParams) (Board, error)
	GetPublicBoardBySlug(ctx context.Context, slug string) (Board, error)
	GetBoardIdBySlug(ctx context.Context, slug string) (pgtype.UUID, error)
	CreateBoard(ctx context.Context, arg CreateBoardParams) (Board, error)
	UpdateBoard(ctx context.Context, arg UpdateBoardParams) (Board, error)
	DeleteBoard(ctx context.Context, id pgtype.UUID) error
}

// Handler will use this
type BoardService interface {
	FindAll(ctx context.Context, userID string, parentID string) ([]BoardResponseDto, error)
	FindBySlug(ctx context.Context, slug string, userID string, parentID string) (*BoardResponseDto, error)
	Create(ctx context.Context, dto CreateBoardRequestDto, userID string, parentID string) (*BoardResponseDto, error)
	Update(ctx context.Context, id string, dto UpdateBoardRequestDto, userID string, parentID string) (*BoardResponseDto, error)
	Remove(ctx context.Context, id string, userID string, parentID string) error
	FindPublicBySlug(ctx context.Context, slug string) (*BoardResponseDto, error)
}
