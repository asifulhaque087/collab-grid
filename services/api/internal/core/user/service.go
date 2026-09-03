package user

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"golang.org/x/crypto/bcrypt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const saltRounds = 10

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows)
}

func resolvePrimaryUserID(userID string, parentID string) (pgtype.UUID, error) {
	id := userID
	if parentID != "" {
		id = parentID
	}

	var uid pgtype.UUID
	if err := uid.Scan(id); err != nil {
		return pgtype.UUID{}, ErrUnauthorized
	}
	return uid, nil
}

func parseUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, ErrInvalidUserID
	}
	return id, nil
}

func parseRoleIDs(ids []string) ([]pgtype.UUID, error) {
	parsed := make([]pgtype.UUID, 0, len(ids))
	for _, raw := range ids {
		var id pgtype.UUID
		if err := id.Scan(raw); err != nil {
			return nil, ErrInvalidRoleID
		}
		parsed = append(parsed, id)
	}
	return parsed, nil
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), saltRounds)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func nonEmpty(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

func textToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	value := t.String
	return &value
}

type Service struct {
	userRepo UserRepo
	logger   *slog.Logger
}

func NewService(userRepo UserRepo, logger *slog.Logger) *Service {
	return &Service{
		userRepo: userRepo,
		logger:   logger,
	}
}

func (s *Service) FindAll(ctx context.Context, userID string, parentID string) ([]UserResponseDto, error) {
	scopeUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	excludeUserID, err := parseUUID(userID)
	if err != nil {
		return nil, ErrUnauthorized
	}

	users, err := s.userRepo.ListWorkspaceUsers(ctx, excludeUserID, scopeUserID)
	if err != nil {
		s.logger.Error("failed to list users", "scope_user_id", scopeUserID.String(), "error", err)
		return nil, ErrInternalServer
	}

	userIDs := make([]pgtype.UUID, 0, len(users))
	for _, u := range users {
		userIDs = append(userIDs, u.ID)
	}

	assignments, err := s.userRepo.ListUserRolesByUserIDs(ctx, userIDs)
	if err != nil {
		s.logger.Error("failed to list user roles", "error", err)
		return nil, ErrInternalServer
	}

	rolesByUser := make(map[pgtype.UUID][]UserRole)
	for _, a := range assignments {
		rolesByUser[a.UserID] = append(rolesByUser[a.UserID], a)
	}

	result := make([]UserResponseDto, 0, len(users))
	for _, u := range users {
		result = append(result, toUserResponseDto(u, rolesByUser[u.ID]))
	}
	return result, nil
}

func (s *Service) Create(ctx context.Context, dto CreateUserRequestDto, userID string, parentID string) (*UserResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	passwordHash, err := hashPassword(dto.Password)
	if err != nil {
		s.logger.Error("failed to hash password", "error", err)
		return nil, ErrInternalServer
	}

	roleIDs, err := parseRoleIDs(dto.RoleIds)
	if err != nil {
		return nil, err
	}

	created, err := s.userRepo.CreateUser(ctx, CreateUserParams{
		Name:          dto.Name,
		Email:         dto.Email,
		PasswordHash:  passwordHash,
		PrimaryUserID: primaryUserID,
	}, roleIDs)
	if err != nil {
		s.logger.Error("failed to create user", "email", dto.Email, "error", err)
		return nil, ErrInternalServer
	}

	return s.findByIdOrNotFound(ctx, created.ID)
}

func (s *Service) Update(ctx context.Context, id string, dto UpdateUserRequestDto) (*UserResponseDto, error) {
	userID, err := parseUUID(id)
	if err != nil {
		return nil, err
	}

	if _, err := s.findByIdOrNotFound(ctx, userID); err != nil {
		return nil, err
	}

	params := UpdateUserParams{
		ID:       userID,
		Name:     nonEmpty(dto.Name),
		Email:    nonEmpty(dto.Email),
		Password: nonEmpty(dto.Password),
	}

	if params.Password != nil {
		passwordHash, err := hashPassword(*params.Password)
		if err != nil {
			s.logger.Error("failed to hash password", "error", err)
			return nil, ErrInternalServer
		}
		params.Password = &passwordHash
	}

	if dto.RoleIds != nil {
		roleIDs, err := parseRoleIDs(*dto.RoleIds)
		if err != nil {
			return nil, err
		}
		params.RoleIDs = roleIDs
	}

	if err := s.userRepo.UpdateUser(ctx, params); err != nil {
		s.logger.Error("failed to update user", "id", id, "error", err)
		return nil, ErrInternalServer
	}

	return s.findByIdOrNotFound(ctx, userID)
}

func (s *Service) Remove(ctx context.Context, id string) error {
	userID, err := parseUUID(id)
	if err != nil {
		return err
	}

	if err := s.userRepo.DeleteUser(ctx, userID); err != nil {
		s.logger.Error("failed to delete user", "id", id, "error", err)
		return ErrInternalServer
	}

	return nil
}

func (s *Service) findByIdOrNotFound(ctx context.Context, id pgtype.UUID) (*UserResponseDto, error) {
	u, err := s.userRepo.GetUserProfileByID(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrUserNotFound
		}
		s.logger.Error("failed to get user by id", "id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	roles, err := s.userRepo.ListUserRolesByUserIDs(ctx, []pgtype.UUID{id})
	if err != nil {
		s.logger.Error("failed to list user roles", "user_id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	response := toUserResponseDto(u, roles)
	return &response, nil
}

func toUserResponseDto(u User, assignments []UserRole) UserResponseDto {
	roles := make([]UserRoleResponseDto, 0, len(assignments))
	for _, a := range assignments {
		roles = append(roles, UserRoleResponseDto{
			ID:    a.RoleID.String(),
			Title: a.Title,
			Slug:  a.Slug,
		})
	}

	return UserResponseDto{
		ID:       u.ID.String(),
		Name:     u.Name,
		Email:    u.Email,
		Provider: textToStringPtr(u.Provider),
		Roles:    roles,
	}
}
