package role

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// Enforcer abstracts the Casbin policy operations needed to keep
// authorization rules in sync with role CRUD.
type Enforcer interface {
	AddPolicy(params ...interface{}) (bool, error)
	RemoveFilteredPolicy(fieldIndex int, fieldValues ...string) (bool, error)
	RemoveFilteredGroupingPolicy(fieldIndex int, fieldValues ...string) (bool, error)
}

// Service will use this
type RoleRepo interface {
	GetUserPermissions(ctx context.Context, userID pgtype.UUID) ([]Permission, error)
	ListAllPermissions(ctx context.Context) ([]Permission, error)
	ListRolesByPrimaryUserID(ctx context.Context, primaryUserID pgtype.UUID) ([]Role, error)
	GetRoleById(ctx context.Context, id pgtype.UUID) (Role, error)
	ListRolePermissionsByRoleIDs(ctx context.Context, roleIDs []pgtype.UUID) ([]RolePermission, error)
	ListRolePermissionEndpoints(ctx context.Context, roleID pgtype.UUID) ([]PermissionEndpoint, error)
	CreateRole(ctx context.Context, arg CreateRoleParams, permissionIDs []pgtype.UUID) (Role, error)
	UpdateRole(ctx context.Context, arg UpdateRoleParams) error
	DeleteRole(ctx context.Context, id pgtype.UUID) error
}

// Handler will use this
type RoleService interface {
	ListPermissions(ctx context.Context, userID string) ([]PermissionResponseDto, error)
	FindAll(ctx context.Context, userID string, parentID string) ([]RoleResponseDto, error)
	Create(ctx context.Context, dto CreateRoleRequestDto, userID string, parentID string) (*RoleResponseDto, error)
	Update(ctx context.Context, id string, dto UpdateRoleRequestDto) (*RoleResponseDto, error)
	Remove(ctx context.Context, id string) error
}
