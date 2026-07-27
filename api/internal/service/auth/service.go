package auth

import (
	"context"
	"fmt"
)

type Service struct {
	authRepo AuthRepo
}

func NewService(authRepo AuthRepo) *Service {
	return &Service{
		authRepo: authRepo,
	}
}

func (s *Service) RegisterUser(ctx context.Context, email string) (*User, error) {
	user, err := s.authRepo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Service) FindAll(ctx context.Context) (*[]User, error) {
	users, err := s.repo.FindAll(ctx)

	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}

	return users, nil
}

func (s *Service) FindById(ctx context.Context, id string) (*User, error) {

	user, err := s.repo.FindById(ctx, id)

	if err != nil {
		return nil, err
	}

	return user, nil

}
