package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/user"
)

type UserRepository struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

func (r *UserRepository) ListWorkspaceUsers(ctx context.Context, excludeUserID pgtype.UUID, scopeUserID pgtype.UUID) ([]user.User, error) {
	rows, err := r.queries.ListWorkspaceUsers(ctx, sqlc.ListWorkspaceUsersParams{
		ExcludeUserID: excludeUserID,
		ScopeUserID:   scopeUserID,
	})
	if err != nil {
		return nil, err
	}
	res := make([]user.User, len(rows))
	for i, row := range rows {
		res[i] = toUser(row.ID, row.Name, row.Email, row.Provider)
	}
	return res, nil
}

func (r *UserRepository) GetUserProfileByID(ctx context.Context, id pgtype.UUID) (user.User, error) {
	row, err := r.queries.GetUserProfileById(ctx, id)
	if err != nil {
		return user.User{}, err
	}
	return toUser(row.ID, row.Name, row.Email, row.Provider), nil
}

func (r *UserRepository) ListUserRolesByUserIDs(ctx context.Context, userIDs []pgtype.UUID) ([]user.UserRole, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}

	rows, err := r.queries.ListUserRolesByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	res := make([]user.UserRole, len(rows))
	for i, row := range rows {
		res[i] = user.UserRole{
			UserID: row.UserID,
			RoleID: row.RoleID,
			Title:  row.Title,
			Slug:   row.Slug,
		}
	}
	return res, nil
}

func (r *UserRepository) CreateUser(ctx context.Context, arg user.CreateUserParams, roleIDs []pgtype.UUID) (user.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return user.User{}, err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	created, err := q.CreateSubUser(ctx, sqlc.CreateSubUserParams{
		Name:          arg.Name,
		Email:         arg.Email,
		Password:      pgtype.Text{String: arg.PasswordHash, Valid: true},
		Provider:      pgtype.Text{String: "credentials", Valid: true},
		PrimaryUserID: arg.PrimaryUserID,
	})
	if err != nil {
		return user.User{}, err
	}

	if len(roleIDs) > 0 {
		if err := q.GrantUserRoles(ctx, sqlc.GrantUserRolesParams{
			UserID:  created.ID,
			RoleIds: roleIDs,
		}); err != nil {
			return user.User{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return user.User{}, err
	}

	return toUser(created.ID, created.Name, created.Email, created.Provider), nil
}

func (r *UserRepository) UpdateUser(ctx context.Context, arg user.UpdateUserParams) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	hasProfileUpdate := arg.Name != nil || arg.Email != nil || arg.Password != nil
	if hasProfileUpdate {
		params := sqlc.UpdateUserProfileParams{ID: arg.ID}
		if arg.Name != nil {
			params.Name = pgtype.Text{String: *arg.Name, Valid: true}
		}
		if arg.Email != nil {
			params.Email = pgtype.Text{String: *arg.Email, Valid: true}
		}
		if arg.Password != nil {
			params.Password = pgtype.Text{String: *arg.Password, Valid: true}
		}

		if _, err := q.UpdateUserProfile(ctx, params); err != nil {
			return err
		}
	}

	if arg.RoleIDs != nil {
		if err := q.DeleteUserRoles(ctx, arg.ID); err != nil {
			return err
		}

		if len(arg.RoleIDs) > 0 {
			if err := q.GrantUserRoles(ctx, sqlc.GrantUserRolesParams{
				UserID:  arg.ID,
				RoleIds: arg.RoleIDs,
			}); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *UserRepository) DeleteUser(ctx context.Context, id pgtype.UUID) error {
	return r.queries.DeleteSubUser(ctx, id)
}

func toUser(id pgtype.UUID, name string, email string, provider pgtype.Text) user.User {
	return user.User{
		ID:       id,
		Name:     name,
		Email:    email,
		Provider: provider,
	}
}
