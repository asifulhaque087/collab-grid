package auth

import (
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type User struct {
	ID                     pgtype.UUID
	Name                   string
	Email                  string
	Password               pgtype.Text
	Provider               pgtype.Text
	RefreshToken           pgtype.Text
	ResetPasswordToken     pgtype.Text
	ResetPasswordExpiresAt pgtype.Timestamp
	PrimaryUserID          pgtype.UUID
	SecondaryUserID        pgtype.UUID
}

type Package struct {
	ID              pgtype.UUID
	Title           string
	Slug            string
	Price           string
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
}

type Role struct {
	ID              pgtype.UUID
	Title           string
	Slug            string
	PrimaryUserID   pgtype.UUID
	SecondaryUserID pgtype.UUID
}

type SignupDefaults struct {
	FreePackage Package
	TenantRole  Role
}

type CreateUserParams struct {
	Name     string
	Email    string
	Password string
	Provider string
}

type AssignUserRoleParams struct {
	UserID pgtype.UUID
	RoleID pgtype.UUID
}

type CreateSubscriptionParams struct {
	UserID        pgtype.UUID
	PackageID     pgtype.UUID
	StartDate     pgtype.Timestamp
	EndDate       pgtype.Timestamp
	PaymentMethod string
	Amount        pgtype.Numeric
}

type GetAccessContextByUserIdRow struct {
	RoleSlug  string
	RoleTitle string
	Action    string
	Subject   string
}

type GetUserQuotasRow struct {
	Action     string
	Subject    string
	LimitCount pgtype.Int4
	TotalUsed  int64
}

type SetResetPasswordTokenParams struct {
	ResetPasswordToken     pgtype.Text
	ResetPasswordExpiresAt pgtype.Timestamp
	ID                     pgtype.UUID
}

type UpdatePasswordAndClearTokensParams struct {
	Password pgtype.Text
	ID       pgtype.UUID
}

type UpdateRefreshTokenParams struct {
	RefreshToken pgtype.Text
	ID           pgtype.UUID
}

type JwtPayload struct {
	ID              string `json:"id"`
	Email           string `json:"email"`
	PrimaryUserID   string `json:"primary_user_id,omitempty"`
	SecondaryUserID string `json:"secondary_user_id,omitempty"`
	jwt.RegisteredClaims
}
