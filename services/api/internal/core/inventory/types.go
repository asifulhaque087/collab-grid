package inventory

import (
	"github.com/jackc/pgx/v5/pgtype"
)

type SmartWidget struct {
	ID              pgtype.UUID
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
	BoardID         pgtype.UUID
	Sku             string
	Photo           pgtype.Text
	Quantity        int32
	Price           pgtype.Numeric
	Name            string
	PosX            pgtype.Numeric
	PosY            pgtype.Numeric
	Width           int32
	Height          int32
	CreatedAt       pgtype.Timestamp
	UpdatedAt       pgtype.Timestamp
	BoardName       pgtype.Text
}

type GetSmartWidgetByIdParams struct {
	ID            pgtype.UUID
	PrimaryUserID pgtype.UUID
}

type CreateSmartWidgetParams struct {
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
	BoardID         pgtype.UUID
	Name            string
	Sku             string
	Quantity        int32
	Price           pgtype.Numeric
	Photo           pgtype.Text
	Width           int32
	Height          int32
}

type UpdateSmartWidgetParams struct {
	ID       pgtype.UUID
	Name     pgtype.Text
	Sku      pgtype.Text
	Quantity pgtype.Int4
	Price    pgtype.Numeric
	Photo    pgtype.Text
	BoardID  pgtype.UUID
	Width    pgtype.Int4
	Height   pgtype.Int4
}
