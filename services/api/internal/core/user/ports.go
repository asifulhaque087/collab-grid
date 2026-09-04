package user

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

type UserRepo interface {
	ListWorkspaceUsers(ctx context.Context, excludeUserID pgtype.UUID, scopeUserID pgtype.UUID) ([]User, error)
	GetUserProfileByID(ctx context.Context, id pgtype.UUID) (User, error)
	ListUserRolesByUserIDs(ctx context.Context, userIDs []pgtype.UUID) ([]UserRole, error)
	CreateUser(ctx context.Context, arg CreateUserParams, roleIDs []pgtype.UUID) (User, error)
	UpdateUser(ctx context.Context, arg UpdateUserParams) error
	DeleteUser(ctx context.Context, id pgtype.UUID) error
}

type UserService interface {
	FindAll(ctx context.Context, userID string, parentID string) ([]UserResponseDto, error)
	Create(ctx context.Context, dto CreateUserRequestDto, userID string, parentID string) (*UserResponseDto, error)
	Update(ctx context.Context, id string, dto UpdateUserRequestDto) (*UserResponseDto, error)
	Remove(ctx context.Context, id string) error
}
