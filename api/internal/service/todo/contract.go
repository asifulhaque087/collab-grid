package todo

import (
	"context"
)

type TodoRepo interface {
	FindById(ctx context.Context, todoId string) (*Todo, error)
	FindAll(ctx context.Context) (*[]Todo, error)
	Create(ctx context.Context, title string) (*Todo, error)
}

type UserService interface {
	FindById(ctx context.Context, todoId string) (*Todo, error)
	FindAll(ctx context.Context) (*[]Todo, error)
	Create(ctx context.Context, title string) (*Todo, error)
}
