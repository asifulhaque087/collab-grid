package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/loot-board/services/api/internal/service/subscription"
)

type SubscriptionRepository struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewSubscriptionRepository(pool *pgxpool.Pool) *SubscriptionRepository {
	return &SubscriptionRepository{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

func (r *SubscriptionRepository) GetPackageBySlug(ctx context.Context, slug string) (subscription.Package, error) {
	row, err := r.queries.GetPackageBySlug(ctx, slug)
	if err != nil {
		return subscription.Package{}, err
	}
	return subscription.Package{
		ID:    row.ID,
		Slug:  row.Slug,
		Title: row.Title,
	}, nil
}

func (r *SubscriptionRepository) ListSubscriptionsByUser(ctx context.Context, userID pgtype.UUID) ([]subscription.Subscription, error) {
	rows, err := r.queries.ListSubscriptionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := make([]subscription.Subscription, 0, len(rows))
	for _, row := range rows {
		result = append(result, subscription.Subscription{
			ID:            row.ID,
			PackageID:     row.PackageID,
			PackageTitle:  row.PackageTitle,
			PackageSlug:   row.PackageSlug,
			StartDate:     row.StartDate,
			EndDate:       row.EndDate,
			PaymentMethod: row.PaymentMethod,
			Amount:        row.Amount,
		})
	}
	return result, nil
}

func (r *SubscriptionRepository) GetSubscriptionByUserAndPackage(ctx context.Context, userID, packageID pgtype.UUID) (pgtype.UUID, error) {
	return r.queries.GetSubscriptionByUserAndPackage(ctx, sqlc.GetSubscriptionByUserAndPackageParams{
		UserID:    userID,
		PackageID: packageID,
	})
}

func (r *SubscriptionRepository) CreateSubscription(ctx context.Context, arg subscription.CreateSubscriptionParams) (subscription.Subscription, error) {
	row, err := r.queries.CreateSubscriptionReturning(ctx, sqlc.CreateSubscriptionReturningParams{
		UserID:        arg.UserID,
		PackageID:     arg.PackageID,
		StartDate:     arg.StartDate,
		EndDate:       arg.EndDate,
		PaymentMethod: arg.PaymentMethod,
		Amount:        arg.Amount,
	})
	if err != nil {
		return subscription.Subscription{}, err
	}

	return subscription.Subscription{
		ID:            row.ID,
		PackageID:     row.PackageID,
		StartDate:     row.StartDate,
		EndDate:       row.EndDate,
		PaymentMethod: row.PaymentMethod,
		Amount:        row.Amount,
	}, nil
}
