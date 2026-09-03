package boards

import (
	"github.com/jackc/pgx/v5/pgtype"
)

type Board struct {
	ID              pgtype.UUID
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
	Name            string
	Slug            string
	Access          string
	MaxWidth        pgtype.Int4
	MaxHeight       pgtype.Int4
	CreatedAt       pgtype.Timestamp
	UpdatedAt       pgtype.Timestamp
	WidgetCount     int64
}

type GetBoardByIdParams struct {
	ID            pgtype.UUID
	PrimaryUserID pgtype.UUID
}

type GetBoardBySlugParams struct {
	Slug          string
	PrimaryUserID pgtype.UUID
}

type CreateBoardParams struct {
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
	Name            string
	Slug            string
	Access          string
	MaxWidth        pgtype.Int4
	MaxHeight       pgtype.Int4
}

type UpdateBoardParams struct {
	ID        pgtype.UUID
	Name      pgtype.Text
	Access    pgtype.Text
	MaxWidth  pgtype.Int4
	MaxHeight pgtype.Int4
}
