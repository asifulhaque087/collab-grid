package todo

import (
	"context"
	"fmt"

	repo "github.com/asifulhaque087/todo-go-lang/internal/adapters/sqlc"
)

type Service struct {
	// todoRepo TodoRepo
	todoRepo repo.Querier
	// repo repo.Querier
}

func NewService(todoRepo repo.Querier) *Service {
	return &Service{
		todoRepo: todoRepo,
	}
}

func (s *Service) Create(ctx context.Context, title string) (*Todo, error) {

	todo, err := s.todoRepo.Create(ctx, title)
	// todo, err := s.repo.AssignUserRole()

	if err != nil {
		// return nil, fmt.Errorf("Failed to create todo: %w", err)
		return nil, err
	}

	return todo, nil

}

func (s *Service) FindAll(ctx context.Context) (*[]Todo, error) {
	todos, err := s.todoRepo.FindAll(ctx)

	if err != nil {
		return nil, fmt.Errorf("failed to get trip fare: %w", err)
	}

	return todos, nil
}

func (s *Service) FindById(ctx context.Context, id string) (*Todo, error) {

	todo, err := s.todoRepo.FindById(ctx, id)

	if err != nil {
		return nil, err
	}

	return todo, nil

}
