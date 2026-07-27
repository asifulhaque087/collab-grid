package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

const saltRounds = 12

type Service struct {
	authRepo AuthRepo
	logger   *slog.Logger
	cfg      *config.Config
}

func NewService(authRepo AuthRepo, logger *slog.Logger, cfg *config.Config) *Service {
	return &Service{
		authRepo: authRepo,
		logger:   logger,
		cfg:      cfg,
	}
}

func (s *Service) RegisterUser(ctx context.Context, dto RegisterUserDto) (*RegisterResponse, error) {

	// Check for user

	existing, err := s.authRepo.GetUserByEmail(ctx, dto.Email)

	if err != nil {
		s.logger.Error("failed to query user by email",
			"email", dto.Email,
			"error", err,
		)
		return nil, ErrInternalServer
	}

	if existing.ID.Valid {
		s.logger.Info("registration blocked: email already exists", "email", dto.Email)
		return nil, ErrEmailConflict
	}

	// Resolve for user

	defaults, err := s.ResolveSignupDefaults(ctx)
	if err != nil {
		s.logger.Error("failed to resolve signup defaults", "error", err)
		return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
	}

	// Hash the password

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(dto.Password), saltRounds)
	if err != nil {
		s.logger.Error("failed to hash password", "error", err)
		return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
	}

	// Create User

	user, err := s.CreateUserWithFreePlan(ctx, CreateUserParams{
		Name:     dto.Name,
		Email:    dto.Email,
		Password: string(hashedBytes),
		Provider: "credentials",
	}, defaults)
	if err != nil {
		s.logger.Error("failed to create user in db", "email", dto.Email, "error", err)
		return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
	}

	// Generate Tokens

	tokens, err := s.GenerateTokens(ctx, user.ID, user.Email, user.PrimaryUserID, user.SecondaryUserID)
	if err != nil || tokens == nil {
		s.logger.Error("failed to generate auth tokens", "user_id", user.ID, "error", err)
		return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
	}

	// Returns

	s.logger.Info("user successfully registered", "user_id", user.ID, "email", user.Email)

	return &RegisterResponse{
		// User:         *user,
		ID:           user.ID.String(),
		Name:         user.Name,
		Email:        user.Email,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	}, nil

}

func (s *Service) ResolveSignupDefaults(ctx context.Context) (*SignupDefaults, error) {
	freePackage, err := s.authRepo.GetPackageBySlug(ctx, FreePackageSlug)
	if errors.Is(err, sql.ErrNoRows) {
		s.logger.ErrorContext(ctx, "default package missing in database", slog.String("slug", FreePackageSlug))
		return nil, fmt.Errorf("default package is missing — run the database seed: %w", err)
	}
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to query default package", slog.String("slug", FreePackageSlug), slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to fetch default package: %w", err)
	}

	tenantRole, err := s.authRepo.GetRoleBySlug(ctx, TenantRoleSlug)
	if errors.Is(err, sql.ErrNoRows) {
		s.logger.ErrorContext(ctx, "default role missing in database", slog.String("slug", TenantRoleSlug))
		return nil, fmt.Errorf("default role is missing — run the database seed: %w", err)
	}
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to query default role", slog.String("slug", TenantRoleSlug), slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to fetch default role: %w", err)
	}

	s.logger.DebugContext(ctx, "resolved signup defaults successfully",
		slog.String("package", freePackage.Slug),
		slog.String("role", tenantRole.Slug),
	)

	return &SignupDefaults{
		FreePackage: freePackage,
		TenantRole:  tenantRole,
	}, nil
}

// func (s *Service) GenerateTokens() () {}
// func (s *Service) IsTokenExpired() () {}

func (s *Service) GenerateTokens(
	ctx context.Context,
	id pgtype.UUID,
	email string,
	primaryUserID pgtype.UUID,
	secondaryUserID pgtype.UUID,
) (*AuthTokens, error) {
	// Helper to safely extract string pointer from optional pgtype.UUID
	uuidToPtr := func(u pgtype.UUID) *string {
		if !u.Valid {
			return nil
		}
		str := fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
		return &str
	}

	// Format primary ID string for JWT claims
	idStr := fmt.Sprintf("%x-%x-%x-%x-%x", id.Bytes[0:4], id.Bytes[4:6], id.Bytes[6:8], id.Bytes[8:10], id.Bytes[10:16])

	// 1. Build Payload / Claims
	claims := JwtPayload{
		ID:              idStr,
		Email:           email,
		PrimaryUserID:   uuidToPtr(primaryUserID),
		SecondaryUserID: uuidToPtr(secondaryUserID),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.cfg.AccessTokenExpiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// 2. Generate Access Token
	accessTok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := accessTok.SignedString([]byte(s.cfg.AccessTokenSecret))
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to sign access token", slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// 3. Generate Refresh Token
	refreshClaims := claims
	refreshClaims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(s.cfg.RefreshTokenExpiration))

	refreshTok := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTok.SignedString([]byte(s.cfg.RefreshTokenSecret))
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to sign refresh token", slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	// 4. Store Refresh Token in DB via AuthRepo
	err = s.authRepo.UpdateRefreshToken(ctx, repo.UpdateRefreshTokenParams{
		ID:           id, // Direct pass through, no Scan needed!
		RefreshToken: pgtype.Text{String: refreshToken, Valid: true},
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to save refresh token to database",
			slog.String("user_id", idStr),
			slog.String("error", err.Error()),
		)
		return nil, fmt.Errorf("failed to save refresh token: %w", err)
	}

	return &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *Service) IsTokenExpired(tokenString string, secret string) bool {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithLeeway(10*time.Second)) // 10s clockTolerance match from NestJS

	if err != nil {
		return true
	}

	return !token.Valid
}

func (s *Service) CreateUserWithFreePlan(
	ctx context.Context,
	params CreateUserParams,
	defaults *SignupDefaults,
) (*repo.User, error) {
	var user repo.User

	// 1. Convert string "0" to pgtype.Numeric
	var amountNumeric pgtype.Numeric
	if err := amountNumeric.Scan("0"); err != nil {
		return nil, fmt.Errorf("failed to parse amount into pgtype.Numeric: %w", err)
	}

	// 2. Execute database transaction
	err := s.authRepo.ExecTx(ctx, func(q *repo.Queries) error {
		var err error

		// Insert User
		user, err = q.CreateUser(ctx, repo.CreateUserParams{
			Name:     params.Name,
			Email:    params.Email,
			Password: pgtype.Text{String: params.Password, Valid: params.Password != ""},
			Provider: pgtype.Text{String: params.Provider, Valid: params.Provider != ""},
		})
		if err != nil {
			return fmt.Errorf("failed to insert user: %w", err)
		}

		// Insert User Role
		err = q.AssignUserRole(ctx, repo.AssignUserRoleParams{
			UserID: user.ID,
			RoleID: defaults.TenantRole.ID,
		})
		if err != nil {
			return fmt.Errorf("failed to assign user role: %w", err)
		}

		// Insert Subscription
		err = q.CreateSubscription(ctx, repo.CreateSubscriptionParams{
			UserID:        user.ID,
			PackageID:     defaults.FreePackage.ID,
			StartDate:     pgtype.Timestamp{Time: time.Now(), Valid: true}, // Fixed: pgtype.Timestamp
			EndDate:       pgtype.Timestamp{Valid: false},                  // Fixed: pgtype.Timestamp NULL
			PaymentMethod: "manual",
			Amount:        amountNumeric, // Fixed: pgtype.Numeric
		})
		if err != nil {
			return fmt.Errorf("failed to create subscription: %w", err)
		}

		return nil
	})

	if err != nil {
		s.logger.ErrorContext(ctx, "transaction failed during user creation",
			slog.String("email", params.Email),
			slog.String("error", err.Error()),
		)
		return nil, fmt.Errorf("createUserWithFreePlan tx error: %w", err)
	}

	return &user, nil
}
