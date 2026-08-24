package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
)

const saltRounds = 12

type Service struct {
	authRepo     AuthRepo
	uow          UnitOfWork
	logger       *slog.Logger
	cfg          *config.Config
	googleConfig *oauth2.Config
	mailSvc      AuthMailService
}

func NewService(authRepo AuthRepo, uow UnitOfWork, logger *slog.Logger, cfg *config.Config, mailSvc AuthMailService) *Service {
	return &Service{
		authRepo:     authRepo,
		uow:          uow,
		logger:       logger,
		cfg:          cfg,
		googleConfig: NewGoogleConfig(cfg),
		mailSvc:      mailSvc,
	}
}

func (s *Service) RegisterUser(ctx context.Context, dto RegisterUserRequestDto) (*RegisterUserResponseDto, error) {

	// Check for user

	_, err := s.authRepo.GetUserByEmail(ctx, dto.Email)

	// 1. Real DB failure (anything other than "not found")
	if err != nil && !errors.Is(err, sql.ErrNoRows) { // or pgx.ErrNoRows
		s.logger.Error("failed to query user by email", "email", dto.Email, "error", err)
		return nil, ErrInternalServer
	}

	// 2. User was found (no error at all means record exists)
	if err == nil {
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

	return &RegisterUserResponseDto{
		ID:           user.ID.String(),
		Name:         user.Name,
		Email:        user.Email,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	}, nil

}

func (s *Service) LoginUser(ctx context.Context, dto LoginUserRequestDto) (*RegisterUserResponseDto, error) {
	user, err := s.authRepo.GetUserByEmail(ctx, dto.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		s.logger.Error("failed to query user by email", "email", dto.Email, "error", err)
		return nil, ErrInternalServer
	}

	if !user.Password.Valid || user.Password.String == "" {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password.String), []byte(dto.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	tokens, err := s.GenerateTokens(ctx, user.ID, user.Email, user.PrimaryUserID, user.SecondaryUserID)
	if err != nil || tokens == nil {
		s.logger.Error("failed to generate auth tokens", "user_id", user.ID.String(), "error", err)
		return nil, ErrInternalServer
	}

	s.logger.Info("user successfully logged in", "user_id", user.ID.String(), "email", user.Email)

	return &RegisterUserResponseDto{
		ID:           user.ID.String(),
		Name:         user.Name,
		Email:        user.Email,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	}, nil
}

func (s *Service) ForgotPassword(ctx context.Context, dto ForgotPasswordRequestDto) (*ForgotPasswordResponseDto, error) {
	user, err := s.authRepo.GetUserByEmail(ctx, dto.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &ForgotPasswordResponseDto{Message: ForgotPasswordSuccessMsg}, nil
		}
		s.logger.Error("failed to query user by email", "email", dto.Email, "error", err)
		return nil, ErrInternalServer
	}

	if !user.Password.Valid || user.Password.String == "" {
		return &ForgotPasswordResponseDto{Message: ForgotPasswordSuccessMsg}, nil
	}

	rawToken, err := generateResetToken()
	if err != nil {
		s.logger.Error("failed to generate reset token", "error", err)
		return nil, ErrInternalServer
	}

	tokenHash := hashResetToken(rawToken)
	expiresAt := time.Now().Add(s.cfg.ResetTokenExpiration)

	err = s.authRepo.SetResetPasswordToken(ctx, SetResetPasswordTokenParams{
		ResetPasswordToken:     pgtype.Text{String: tokenHash, Valid: true},
		ResetPasswordExpiresAt: pgtype.Timestamp{Time: expiresAt, Valid: true},
		ID:                     user.ID,
	})
	if err != nil {
		s.logger.Error("failed to set reset password token", "user_id", user.ID.String(), "error", err)
		return nil, ErrInternalServer
	}

	resetURL := fmt.Sprintf("%s?token=%s", s.cfg.ResetPasswordURL, rawToken)
	expirationMinutes := int(s.cfg.ResetTokenExpiration.Minutes())

	err = s.mailSvc.SendPasswordResetEmail(user.Email, user.Name, resetURL, expirationMinutes)
	if err != nil {
		s.logger.Error("failed to send password reset email", "email", user.Email, "error", err)
		return nil, ErrInternalServer
	}

	s.logger.Info("password reset email sent", "email", user.Email)

	return &ForgotPasswordResponseDto{Message: ForgotPasswordSuccessMsg}, nil
}

func generateResetToken() (string, error) {
	b := make([]byte, ResetTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashResetToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
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

func (s *Service) GenerateTokens(
	ctx context.Context,
	id pgtype.UUID,
	email string,
	primaryUserID pgtype.UUID,
	secondaryUserID pgtype.UUID,
) (*AuthTokensResponseDto, error) {

	// 1. Build Payload / Claims
	claims := JwtPayload{
		ID:              id.String(),
		Email:           email,
		PrimaryUserID:   primaryUserID.String(),
		SecondaryUserID: secondaryUserID.String(),
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
	err = s.authRepo.UpdateRefreshToken(ctx, UpdateRefreshTokenParams{
		ID:           id,
		RefreshToken: pgtype.Text{String: refreshToken, Valid: true},
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to save refresh token to database",
			slog.String("user_id", id.String()),
			slog.String("error", err.Error()),
		)
		return nil, fmt.Errorf("failed to save refresh token: %w", err)
	}

	return &AuthTokensResponseDto{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *Service) ValidateAccessToken(tokenString string) (*JwtPayload, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JwtPayload{}, func(token *jwt.Token) (interface{}, error) {
		// Ensure signing method matches expectations
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.AccessTokenSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JwtPayload)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

func (s *Service) CreateUserWithFreePlan(
	ctx context.Context,
	params CreateUserParams,
	defaults *SignupDefaults,
) (*User, error) {
	var user User

	// 1. Convert string "0" to pgtype.Numeric
	var amountNumeric pgtype.Numeric
	if err := amountNumeric.Scan("0"); err != nil {
		return nil, fmt.Errorf("failed to parse amount into pgtype.Numeric: %w", err)
	}

	// 2. Execute database transaction

	err := s.uow.RunInTx(ctx, func(tx Stores) error {

		var err error

		// Insert User
		user, err = tx.Auth.CreateUser(ctx, params)
		if err != nil {
			return fmt.Errorf("failed to insert user: %w", err)
		}

		// Insert User Role
		err = tx.Auth.AssignUserRole(ctx, AssignUserRoleParams{
			UserID: user.ID,
			RoleID: defaults.TenantRole.ID,
		})
		if err != nil {
			return fmt.Errorf("failed to assign user role: %w", err)
		}

		// Insert Subscription
		err = tx.Auth.CreateSubscription(ctx, CreateSubscriptionParams{
			UserID:        user.ID,
			PackageID:     defaults.FreePackage.ID,
			StartDate:     pgtype.Timestamp{Time: time.Now(), Valid: true},
			EndDate:       pgtype.Timestamp{Valid: false},
			PaymentMethod: "manual",
			Amount:        amountNumeric,
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

func (s *Service) GoogleLogin(ctx context.Context) string {
	return s.googleConfig.AuthCodeURL("random_csrf_state_token")
}

func (s *Service) GoogleCallback(ctx context.Context, code string) (*RegisterUserResponseDto, error) {
	token, err := s.googleConfig.Exchange(ctx, code)
	if err != nil {
		s.logger.ErrorContext(ctx, "google code exchange failed", slog.String("error", err.Error()))
		return nil, fmt.Errorf("code exchange failed: %w", err)
	}

	client := s.googleConfig.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to fetch google user info", slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var googleUser GoogleUserInfoDto
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		s.logger.ErrorContext(ctx, "failed to decode google user info", slog.String("error", err.Error()))
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return s.ValidateSocialUser(ctx, ValidateSocialUserRequestDto{
		Email:    googleUser.Email,
		Name:     googleUser.Name,
		Provider: "google",
	})
}

func (s *Service) ValidateSocialUser(ctx context.Context, dto ValidateSocialUserRequestDto) (*RegisterUserResponseDto, error) {
	existing, err := s.authRepo.GetUserByEmail(ctx, dto.Email)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.logger.ErrorContext(ctx, "failed to query social user by email",
			slog.String("email", dto.Email),
			slog.String("error", err.Error()),
		)
		return nil, ErrInternalServer
	}

	var user *User

	if errors.Is(err, sql.ErrNoRows) {
		defaults, err := s.ResolveSignupDefaults(ctx)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to resolve signup defaults for social user",
				slog.String("email", dto.Email),
				slog.String("error", err.Error()),
			)
			return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
		}

		created, err := s.CreateUserWithFreePlan(ctx, CreateUserParams{
			Name:     dto.Name,
			Email:    dto.Email,
			Provider: dto.Provider,
		}, defaults)
		if err != nil {
			s.logger.ErrorContext(ctx, "failed to create social user",
				slog.String("email", dto.Email),
				slog.String("error", err.Error()),
			)
			return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
		}
		user = created
	} else {
		user = &existing
	}

	tokens, err := s.GenerateTokens(ctx, user.ID, user.Email, user.PrimaryUserID, user.SecondaryUserID)
	if err != nil || tokens == nil {
		s.logger.ErrorContext(ctx, "failed to generate tokens for social user",
			slog.String("user_id", user.ID.String()),
			slog.Any("error", err),
		)
		return nil, fmt.Errorf("%w: %v", ErrInternalServer, err)
	}

	return &RegisterUserResponseDto{
		ID:           user.ID.String(),
		Name:         user.Name,
		Email:        user.Email,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	}, nil
}
