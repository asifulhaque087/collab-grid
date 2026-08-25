package user

import "github.com/jackc/pgx/v5/pgtype"

type User struct {
	ID       pgtype.UUID
	Name     string
	Email    string
	Provider pgtype.Text
}

type UserRole struct {
	UserID pgtype.UUID
	RoleID pgtype.UUID
	Title  string
	Slug   string
}

type CreateUserParams struct {
	Name          string
	Email         string
	PasswordHash  string
	PrimaryUserID pgtype.UUID
}

type UpdateUserParams struct {
	ID       pgtype.UUID
	Name     *string
	Email    *string
	Password *string
	RoleIDs  []pgtype.UUID
}
