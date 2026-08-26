package pkg

import "github.com/jackc/pgx/v5/pgtype"

type Package struct {
	ID              pgtype.UUID
	Title           string
	Slug            string
	Price           string
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
	SubscriberCount int64
}

type Permission struct {
	ID          pgtype.UUID
	Name        string
	Action      string
	Subject     string
	Description pgtype.Text
}

type PackagePermission struct {
	PackageID    pgtype.UUID
	PermissionID pgtype.UUID
	Name         string
	Action       string
	Subject      string
	Limit        *int32
}

type CreatePackageParams struct {
	Slug            string
	Title           string
	Price           string
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
}

type PackagePermissionInput struct {
	PermissionID pgtype.UUID
	Limit        *int32
}

type UpdatePackageParams struct {
	ID          pgtype.UUID
	Title       *string
	Slug        *string
	Price       *string
	Permissions *[]PackagePermissionInput
}
