package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/role"
)

type RoleRepository struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRoleRepository(pool *pgxpool.Pool) *RoleRepository {
	return &RoleRepository{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

func (r *RoleRepository) GetUserPermissions(ctx context.Context, userID pgtype.UUID) ([]role.Permission, error) {
	rows, err := r.queries.GetUserPermissions(ctx, userID)
	if err != nil {
		return nil, err
	}
	res := make([]role.Permission, len(rows))
	for i, row := range rows {
		res[i] = role.Permission{
			ID:          row.ID,
			Name:        row.Name,
			Action:      row.Action,
			Subject:     row.Subject,
			Description: row.Description,
		}
	}
	return res, nil
}

func (r *RoleRepository) ListAllPermissions(ctx context.Context) ([]role.Permission, error) {
	rows, err := r.queries.ListAllPermissions(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]role.Permission, len(rows))
	for i, row := range rows {
		res[i] = role.Permission{
			ID:          row.ID,
			Name:        row.Name,
			Action:      row.Action,
			Subject:     row.Subject,
			Description: row.Description,
		}
	}
	return res, nil
}

func (r *RoleRepository) ListRolesByPrimaryUserID(ctx context.Context, primaryUserID pgtype.UUID) ([]role.Role, error) {
	rows, err := r.queries.ListRolesByPrimaryUserID(ctx, primaryUserID)
	if err != nil {
		return nil, err
	}
	res := make([]role.Role, len(rows))
	for i, row := range rows {
		res[i] = toRole(row.ID, row.Title, row.Slug, row.PrimaryUserID, row.SecondaryUserID, row.MemberCount)
	}
	return res, nil
}

func (r *RoleRepository) GetRoleById(ctx context.Context, id pgtype.UUID) (role.Role, error) {
	row, err := r.queries.GetRoleById(ctx, id)
	if err != nil {
		return role.Role{}, err
	}
	return toRole(row.ID, row.Title, row.Slug, row.PrimaryUserID, row.SecondaryUserID, row.MemberCount), nil
}

func (r *RoleRepository) ListRolePermissionsByRoleIDs(ctx context.Context, roleIDs []pgtype.UUID) ([]role.RolePermission, error) {
	if len(roleIDs) == 0 {
		return nil, nil
	}

	rows, err := r.queries.ListRolePermissionsByRoleIDs(ctx, roleIDs)
	if err != nil {
		return nil, err
	}
	res := make([]role.RolePermission, len(rows))
	for i, row := range rows {
		res[i] = role.RolePermission{
			RoleID:       row.RoleID,
			PermissionID: row.PermissionID,
			Name:         row.PermissionName,
			Action:       row.PermissionAction,
			Subject:      row.PermissionSubject,
		}
	}
	return res, nil
}

func (r *RoleRepository) ListRolePermissionEndpoints(ctx context.Context, roleID pgtype.UUID) ([]role.PermissionEndpoint, error) {
	rows, err := r.queries.ListRolePermissionEndpoints(ctx, roleID)
	if err != nil {
		return nil, err
	}
	res := make([]role.PermissionEndpoint, len(rows))
	for i, row := range rows {
		res[i] = role.PermissionEndpoint{
			Endpoint: row.Endpoint,
			Method:   row.Method,
		}
	}
	return res, nil
}

// CreateRole inserts the role and its permission grants in a single transaction.
func (r *RoleRepository) CreateRole(ctx context.Context, arg role.CreateRoleParams, permissionIDs []pgtype.UUID) (role.Role, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return role.Role{}, err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	created, err := q.CreateRole(ctx, sqlc.CreateRoleParams{
		Slug:            arg.Slug,
		Title:           arg.Title,
		PrimaryUserID:   arg.PrimaryUserID,
		SecondaryUserID: arg.SecondaryUserID,
	})
	if err != nil {
		return role.Role{}, err
	}

	if len(permissionIDs) > 0 {
		if err := q.CreateRolePermissions(ctx, sqlc.CreateRolePermissionsParams{
			RoleID:        created.ID,
			PermissionIds: permissionIDs,
		}); err != nil {
			return role.Role{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return role.Role{}, err
	}

	return role.Role{
		ID:              created.ID,
		Title:           created.Title,
		Slug:            created.Slug,
		PrimaryUserID:   created.PrimaryUserID,
		SecondaryUserID: created.SecondaryUserID,
	}, nil
}

// UpdateRole applies the title change and replaces permission grants in a
// single transaction. PermissionIDs nil leaves grants untouched.
func (r *RoleRepository) UpdateRole(ctx context.Context, arg role.UpdateRoleParams) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	if arg.Title != nil {
		if _, err := q.UpdateRole(ctx, sqlc.UpdateRoleParams{
			Title: *arg.Title,
			ID:    arg.ID,
		}); err != nil {
			return err
		}
	}

	if arg.PermissionIDs != nil {
		if err := q.DeleteRolePermissions(ctx, arg.ID); err != nil {
			return err
		}

		if len(arg.PermissionIDs) > 0 {
			if err := q.CreateRolePermissions(ctx, sqlc.CreateRolePermissionsParams{
				RoleID:        arg.ID,
				PermissionIds: arg.PermissionIDs,
			}); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *RoleRepository) DeleteRole(ctx context.Context, id pgtype.UUID) error {
	return r.queries.DeleteRole(ctx, id)
}

func toRole(
	id pgtype.UUID,
	title string,
	slug string,
	primaryUserID pgtype.UUID,
	secondaryUserID pgtype.UUID,
	memberCount int64,
) role.Role {
	return role.Role{
		ID:              id,
		Title:           title,
		Slug:            slug,
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
		MemberCount:     memberCount,
	}
}
