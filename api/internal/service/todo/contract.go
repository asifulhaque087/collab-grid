package todo

import (
	"context"

	repo "github.com/asifulhaque087/todo-go-lang/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

type TodoRepo interface {
	// FindById(ctx context.Context, todoId string) (*Todo, error)
	// FindAll(ctx context.Context) (*[]Todo, error)
	// Create(ctx context.Context, title string) (*Todo, error)

	AssignUserRole(ctx context.Context, arg repo.AssignUserRoleParams) error
	ClearRefreshToken(ctx context.Context, id pgtype.UUID) error
}

type UserService interface {
	FindById(ctx context.Context, todoId string) (*Todo, error)
	FindAll(ctx context.Context) (*[]Todo, error)
	Create(ctx context.Context, title string) (*Todo, error)
}
