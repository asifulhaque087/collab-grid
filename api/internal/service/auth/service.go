package auth

import (
	"context"
	"errors"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

const saltRounds = 12

type Service struct {
	authRepo AuthRepo
}

func NewService(authRepo AuthRepo) *Service {
	return &Service{
		authRepo: authRepo,
	}
}

func (s *Service) RegisterUser(ctx context.Context, dto RegisterUserDto) (*RegisterResponse, error) {
	_, err := s.authRepo.GetUserByEmail(ctx, dto.Email)
	if err == nil {
		return nil, ErrEmailAlreadyRegistered
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(dto.Password), saltRounds)
	if err != nil {
		return nil, errors.New("an unexpected error occurred")
	}

	role, err := s.authRepo.GetRoleBySlug(ctx, "member")
	if err != nil {
		return nil, errors.New("an unexpected error occurred")
	}

	pkg, err := s.authRepo.GetPackageBySlug(ctx, "free")
	if err != nil {
		return nil, errors.New("an unexpected error occurred")
	}

	user, err := s.authRepo.CreateUser(ctx, repo.CreateUserParams{
		Name:     dto.Name,
		Email:    dto.Email,
		Password: pgtype.Text{String: string(hashedBytes), Valid: true},
		Provider: pgtype.Text{String: "credentials", Valid: true},
	})
	if err != nil {
		return nil, errors.New("an unexpected error occurred")
	}

	err = s.authRepo.AssignUserRole(ctx, repo.AssignUserRoleParams{
		UserID: user.ID,
		RoleID: role.ID,
	})
	if err != nil {
		return nil, errors.New("an unexpected error occurred")
	}

	err = s.authRepo.CreateSubscription(ctx, repo.CreateSubscriptionParams{
		UserID:        user.ID,
		PackageID:     pkg.ID,
		PaymentMethod: "free",
	})
	if err != nil {
		return nil, errors.New("an unexpected error occurred")
	}

	return &RegisterResponse{
		ID:    user.ID.String(),
		Name:  user.Name,
		Email: user.Email,
	}, nil
}
