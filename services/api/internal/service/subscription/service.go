package subscription

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	auth "github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
)

const FreePackageSlug = auth.FreePackageSlug

// PACKAGE_MONTHLY_PRICE mirrors the TS service's per-slug monthly price map.
// Packages not present here default to 0.
var packageMonthlyPrice = map[string]int{
	"free": 0,
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows)
}

func parseUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, ErrInvalidUserID
	}
	return id, nil
}

func addMonths(base time.Time, months int) time.Time {
	next := base.AddDate(0, months, 0)
	return next
}

func numericToString(n pgtype.Numeric) string {
	if !n.Valid {
		return "0.00"
	}
	if v, err := n.Value(); err == nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "0.00"
}

func timestampToTimePtr(t pgtype.Timestamp) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

type Service struct {
	repo   Repo
	logger *slog.Logger
}

func NewService(repo Repo, logger *slog.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) FindAll(ctx context.Context, userID string) ([]SubscriptionResponseDto, error) {
	uid, err := parseUUID(userID)
	if err != nil {
		return nil, err
	}

	subs, err := s.repo.ListSubscriptionsByUser(ctx, uid)
	if err != nil {
		s.logger.Error("failed to list subscriptions", "error", err)
		return nil, ErrInternalServer
	}

	result := make([]SubscriptionResponseDto, 0, len(subs))
	for _, sub := range subs {
		result = append(result, toSubscriptionResponseDto(sub))
	}
	return result, nil
}

func (s *Service) Subscribe(ctx context.Context, dto CreateSubscriptionDto, userID string) (*SubscriptionResponseDto, error) {
	uid, err := parseUUID(userID)
	if err != nil {
		return nil, err
	}

	pkg, err := s.repo.GetPackageBySlug(ctx, dto.PackageSlug)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrPackageNotFound
		}
		s.logger.Error("failed to get package by slug", "slug", dto.PackageSlug, "error", err)
		return nil, ErrInternalServer
	}

	if pkg.Slug == FreePackageSlug {
		existing, err := s.repo.GetSubscriptionByUserAndPackage(ctx, uid, pkg.ID)
		if err != nil && !isNoRows(err) {
			s.logger.Error("failed to check existing subscription", "error", err)
			return nil, ErrInternalServer
		}
		if existing.Valid {
			return nil, ErrAlreadySubscribedFree
		}
	}

	now := time.Now()
	newExpiry := addMonths(now, dto.DurationMonth)
	monthlyPrice := packageMonthlyPrice[dto.PackageSlug]
	amount := fmt.Sprintf("%.2f", float64(monthlyPrice)*float64(dto.DurationMonth))

	var amountNumeric pgtype.Numeric
	if err := amountNumeric.Scan(amount); err != nil {
		s.logger.Error("failed to scan subscription amount", "amount", amount, "error", err)
		return nil, ErrInternalServer
	}

	created, err := s.repo.CreateSubscription(ctx, CreateSubscriptionParams{
		UserID:        uid,
		PackageID:     pkg.ID,
		StartDate:     pgtype.Timestamp{Time: now, Valid: true},
		EndDate:       pgtype.Timestamp{Time: newExpiry, Valid: true},
		PaymentMethod: "manual",
		Amount:        amountNumeric,
	})
	if err != nil {
		s.logger.Error("failed to create subscription", "error", err)
		return nil, ErrInternalServer
	}

	// The insert does not return the joined package details; reuse what we
	// already fetched to populate the response.
	created.PackageTitle = pkg.Title
	created.PackageSlug = pkg.Slug

	response := toSubscriptionResponseDto(created)
	return &response, nil
}

func toSubscriptionResponseDto(s Subscription) SubscriptionResponseDto {
	return SubscriptionResponseDto{
		ID:            s.ID.String(),
		PackageID:     s.PackageID.String(),
		PackageTitle:  s.PackageTitle,
		PackageSlug:   s.PackageSlug,
		StartDate:     s.StartDate.Time,
		EndDate:       timestampToTimePtr(s.EndDate),
		PaymentMethod: s.PaymentMethod,
		Amount:        numericToString(s.Amount),
	}
}
