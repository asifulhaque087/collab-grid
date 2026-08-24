package auth

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// Service will use this
type AuthRepo interface {
	AssignUserRole(ctx context.Context, arg AssignUserRoleParams) error
	ClearRefreshToken(ctx context.Context, id pgtype.UUID) error
	CreateSubscription(ctx context.Context, arg CreateSubscriptionParams) error
	CreateUser(ctx context.Context, arg CreateUserParams) (User, error)

	GetAccessContextByUserId(ctx context.Context, userID pgtype.UUID) ([]GetAccessContextByUserIdRow, error)
	// ============================================================================
	// 1. Defaults & Seed Checks
	// ============================================================================
	GetPackageBySlug(ctx context.Context, slug string) (Package, error)
	GetRoleBySlug(ctx context.Context, slug string) (Role, error)
	// ============================================================================
	// 2. User & Signup Queries
	// ============================================================================
	GetUserByEmail(ctx context.Context, email string) (User, error)
	GetUserById(ctx context.Context, id pgtype.UUID) (User, error)
	GetUserByRefreshToken(ctx context.Context, refreshToken pgtype.Text) (User, error)
	GetUserByResetToken(ctx context.Context, resetPasswordToken pgtype.Text) (User, error)
	GetUserQuotas(ctx context.Context, userID pgtype.UUID) ([]GetUserQuotasRow, error)
	// ============================================================================
	// 3. Password & Session Management Updates
	// ============================================================================
	SetResetPasswordToken(ctx context.Context, arg SetResetPasswordTokenParams) error
	UpdatePasswordAndClearTokens(ctx context.Context, arg UpdatePasswordAndClearTokensParams) error
	UpdateRefreshToken(ctx context.Context, arg UpdateRefreshTokenParams) error
}

// Enforcer abstracts authorization (e.g., Casbin)
type Enforcer interface {
	Enforce(sub, obj, act string) (bool, error)
}

// AuthMailService handles transactional email for the auth domain.
// The mail provider (in mail/) satisfies this interface.
type AuthMailService interface {
	SendPasswordResetEmail(to string, name string, resetURL string, expirationMinutes int, subject ...string) error
}

// Handler will use this
type AuthService interface {
	RegisterUser(ctx context.Context, dto RegisterUserRequestDto) (*RegisterUserResponseDto, error)
	LoginUser(ctx context.Context, dto LoginUserRequestDto) (*RegisterUserResponseDto, error)
	ForgotPassword(ctx context.Context, dto ForgotPasswordRequestDto) (*ForgotPasswordResponseDto, error)
	GoogleLogin(ctx context.Context) string
	GoogleCallback(ctx context.Context, code string) (*RegisterUserResponseDto, error)
}

type Stores struct {
	Auth AuthRepo
}

type UnitOfWork interface {
	// RunInTx runs fn inside a single transaction. Every store
	// in the Stores value executes against that transaction.
	RunInTx(ctx context.Context, fn func(Stores) error) error
}
