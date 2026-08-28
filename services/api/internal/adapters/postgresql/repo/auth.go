package repo

import (
	"context"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
	"github.com/jackc/pgx/v5/pgtype"
)

type AuthRepository struct {
	queries *sqlc.Queries
}

func NewAuthRepository(db sqlc.DBTX) *AuthRepository {
	return &AuthRepository{
		queries: sqlc.New(db),
	}
}

func (r *AuthRepository) AssignUserRole(ctx context.Context, arg auth.AssignUserRoleParams) error {
	return r.queries.AssignUserRole(ctx, sqlc.AssignUserRoleParams{
		UserID: arg.UserID,
		RoleID: arg.RoleID,
	})
}

func (r *AuthRepository) ClearRefreshToken(ctx context.Context, id pgtype.UUID) error {
	return r.queries.ClearRefreshToken(ctx, id)
}

func (r *AuthRepository) CreateSubscription(ctx context.Context, arg auth.CreateSubscriptionParams) error {
	return r.queries.CreateSubscription(ctx, sqlc.CreateSubscriptionParams{
		UserID:        arg.UserID,
		PackageID:     arg.PackageID,
		StartDate:     arg.StartDate,
		EndDate:       arg.EndDate,
		PaymentMethod: arg.PaymentMethod,
		Amount:        arg.Amount,
	})
}

func (r *AuthRepository) CreateUser(ctx context.Context, arg auth.CreateUserParams) (auth.User, error) {
	u, err := r.queries.CreateUser(ctx, sqlc.CreateUserParams{
		Name:     arg.Name,
		Email:    arg.Email,
		Password: pgtype.Text{String: arg.Password, Valid: arg.Password != ""},
		Provider: pgtype.Text{String: arg.Provider, Valid: arg.Provider != ""},
	})
	if err != nil {
		return auth.User{}, err
	}
	return toAuthUser(u), nil
}

func (r *AuthRepository) GetAccessContextByUserId(ctx context.Context, userID pgtype.UUID) ([]auth.GetAccessContextByUserIdRow, error) {
	rows, err := r.queries.GetAccessContextByUserId(ctx, userID)
	if err != nil {
		return nil, err
	}
	res := make([]auth.GetAccessContextByUserIdRow, len(rows))
	for i, row := range rows {
		res[i] = auth.GetAccessContextByUserIdRow{
			RoleSlug:  row.RoleSlug,
			RoleTitle: row.RoleTitle,
			Action:    row.Action,
			Subject:   row.Subject,
		}
	}
	return res, nil
}

func (r *AuthRepository) GetPackageBySlug(ctx context.Context, slug string) (auth.Package, error) {
	pkg, err := r.queries.GetPackageBySlug(ctx, slug)
	if err != nil {
		return auth.Package{}, err
	}
	return toAuthPackage(pkg), nil
}

func (r *AuthRepository) GetRoleBySlug(ctx context.Context, slug string) (auth.Role, error) {
	role, err := r.queries.GetRoleBySlug(ctx, slug)
	if err != nil {
		return auth.Role{}, err
	}
	return toAuthRole(role), nil
}

func (r *AuthRepository) GetUserByEmail(ctx context.Context, email string) (auth.User, error) {
	u, err := r.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return auth.User{}, err
	}
	return toAuthUser(u), nil
}

func (r *AuthRepository) GetUserById(ctx context.Context, id pgtype.UUID) (auth.User, error) {
	u, err := r.queries.GetUserById(ctx, id)
	if err != nil {
		return auth.User{}, err
	}
	return toAuthUser(u), nil
}

func (r *AuthRepository) GetUserByRefreshToken(ctx context.Context, refreshToken pgtype.Text) (auth.User, error) {
	u, err := r.queries.GetUserByRefreshToken(ctx, refreshToken)
	if err != nil {
		return auth.User{}, err
	}
	return toAuthUser(u), nil
}

func (r *AuthRepository) GetUserByResetToken(ctx context.Context, resetPasswordToken pgtype.Text) (auth.User, error) {
	u, err := r.queries.GetUserByResetToken(ctx, resetPasswordToken)
	if err != nil {
		return auth.User{}, err
	}
	return toAuthUser(u), nil
}

func (r *AuthRepository) GetUserQuotas(ctx context.Context, userID pgtype.UUID) ([]auth.GetUserQuotasRow, error) {
	rows, err := r.queries.GetUserQuotas(ctx, userID)
	if err != nil {
		return nil, err
	}
	res := make([]auth.GetUserQuotasRow, len(rows))
	for i, row := range rows {
		res[i] = auth.GetUserQuotasRow{
			Action:     row.Action,
			Subject:    row.Subject,
			LimitCount: row.LimitCount,
			TotalUsed:  row.TotalUsed,
		}
	}
	return res, nil
}

func (r *AuthRepository) SetResetPasswordToken(ctx context.Context, arg auth.SetResetPasswordTokenParams) error {
	return r.queries.SetResetPasswordToken(ctx, sqlc.SetResetPasswordTokenParams{
		ResetPasswordToken:     arg.ResetPasswordToken,
		ResetPasswordExpiresAt: arg.ResetPasswordExpiresAt,
		ID:                     arg.ID,
	})
}

func (r *AuthRepository) UpdatePasswordAndClearTokens(ctx context.Context, arg auth.UpdatePasswordAndClearTokensParams) error {
	return r.queries.UpdatePasswordAndClearTokens(ctx, sqlc.UpdatePasswordAndClearTokensParams{
		Password: arg.Password,
		ID:       arg.ID,
	})
}

func (r *AuthRepository) UpdateRefreshToken(ctx context.Context, arg auth.UpdateRefreshTokenParams) error {
	return r.queries.UpdateRefreshToken(ctx, sqlc.UpdateRefreshTokenParams{
		RefreshToken: arg.RefreshToken,
		ID:           arg.ID,
	})
}

func toAuthUser(u sqlc.User) auth.User {
	return auth.User{
		ID:                     u.ID,
		Name:                   u.Name,
		Email:                  u.Email,
		Password:               u.Password,
		Provider:               u.Provider,
		RefreshToken:           u.RefreshToken,
		ResetPasswordToken:     u.ResetPasswordToken,
		ResetPasswordExpiresAt: u.ResetPasswordExpiresAt,
		PrimaryUserID:          u.PrimaryUserID,
		SecondaryUserID:        u.SecondaryUserID,
	}
}

func toAuthPackage(p sqlc.Package) auth.Package {
	return auth.Package{
		ID:              p.ID,
		Title:           p.Title,
		Slug:            p.Slug,
		Price:           p.Price,
		PrimaryUserID:   p.PrimaryUserID,
		SecondaryUserID: p.SecondaryUserID,
	}
}

func toAuthRole(r sqlc.Role) auth.Role {
	return auth.Role{
		ID:              r.ID,
		Title:           r.Title,
		Slug:            r.Slug,
		PrimaryUserID:   r.PrimaryUserID,
		SecondaryUserID: r.SecondaryUserID,
	}
}
