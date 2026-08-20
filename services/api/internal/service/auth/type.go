package auth

import (
	"errors"

	repo "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrEmailConflict  = errors.New("email already registered")
	ErrInternalServer = errors.New("an unexpected error occurred")
)

type RegisterUserDto struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	AccessToken  string `json:"accessToken,omitempty"`
	RefreshToken string `json:"refreshToken,omitempty"`
}

type SignupDefaults struct {
	FreePackage repo.Package
	TenantRole  repo.Role
}

type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type JwtPayload struct {
	ID              string `json:"id"`
	Email           string `json:"email"`
	PrimaryUserID   string `json:"primary_user_id,omitempty"`
	SecondaryUserID string `json:"secondary_user_id,omitempty"`
	jwt.RegisteredClaims
}

type CreateUserParams struct {
	Name     string
	Email    string
	Password string
	Provider string
}

type GoogleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type ValidateSocialUserDto struct {
	Email    string
	Name     string
	Provider string
}
