package role

import "github.com/jackc/pgx/v5/pgtype"

type Role struct {
	ID              pgtype.UUID
	Title           string
	Slug            string
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
	MemberCount     int64
}

type Permission struct {
	ID          pgtype.UUID
	Name        string
	Action      string
	Subject     string
	Description pgtype.Text
}

type RolePermission struct {
	RoleID       pgtype.UUID
	PermissionID pgtype.UUID
	Name         string
	Action       string
	Subject      string
}

type PermissionEndpoint struct {
	Endpoint string
	Method   string
}

type CreateRoleParams struct {
	Slug            string
	Title           string
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
}

type UpdateRoleParams struct {
	ID    pgtype.UUID
	Title *string
	// PermissionIDs nil = leave grants unchanged; non-nil = replace the set.
	PermissionIDs []pgtype.UUID
}
