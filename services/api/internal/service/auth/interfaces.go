package auth

import (
	"context"

	repo "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

// Service will use this
type AuthRepo interface {
	AssignUserRole(ctx context.Context, arg repo.AssignUserRoleParams) error
	ClearRefreshToken(ctx context.Context, id pgtype.UUID) error
	CreateSubscription(ctx context.Context, arg repo.CreateSubscriptionParams) error
	CreateUser(ctx context.Context, arg repo.CreateUserParams) (repo.User, error)

	GetAccessContextByUserId(ctx context.Context, userID pgtype.UUID) ([]repo.GetAccessContextByUserIdRow, error)
	// ============================================================================
	// 1. Defaults & Seed Checks
	// ============================================================================
	GetPackageBySlug(ctx context.Context, slug string) (repo.Package, error)
	GetRoleBySlug(ctx context.Context, slug string) (repo.Role, error)
	// ============================================================================
	// 2. User & Signup Queries
	// ============================================================================
	GetUserByEmail(ctx context.Context, email string) (repo.User, error)
	GetUserById(ctx context.Context, id pgtype.UUID) (repo.User, error)
	GetUserByRefreshToken(ctx context.Context, refreshToken pgtype.Text) (repo.User, error)
	GetUserByResetToken(ctx context.Context, resetPasswordToken pgtype.Text) (repo.User, error)
	GetUserQuotas(ctx context.Context, userID pgtype.UUID) ([]repo.GetUserQuotasRow, error)
	// ============================================================================
	// 3. Password & Session Management Updates
	// ============================================================================
	SetResetPasswordToken(ctx context.Context, arg repo.SetResetPasswordTokenParams) error
	UpdatePasswordAndClearTokens(ctx context.Context, arg repo.UpdatePasswordAndClearTokensParams) error
	UpdateRefreshToken(ctx context.Context, arg repo.UpdateRefreshTokenParams) error
}

// Handler will use this
type AuthService interface {
	RegisterUser(ctx context.Context, dto RegisterUserDto) (*RegisterResponse, error)
	GoogleLogin(ctx context.Context) string
	GoogleCallback(ctx context.Context, code string) (*RegisterResponse, error)
}

type Stores struct {
	Auth AuthRepo
}

type UnitOfWork interface {
	// RunInTx runs fn inside a single transaction. Every store
	// in the Stores value executes against that transaction.
	RunInTx(ctx context.Context, fn func(Stores) error) error
}
