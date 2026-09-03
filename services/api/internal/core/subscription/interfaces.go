package subscription

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// Repo is consumed by the Service.
type Repo interface {
	GetPackageBySlug(ctx context.Context, slug string) (Package, error)
	ListSubscriptionsByUser(ctx context.Context, userID pgtype.UUID) ([]Subscription, error)
	GetSubscriptionByUserAndPackage(ctx context.Context, userID, packageID pgtype.UUID) (pgtype.UUID, error)
	CreateSubscription(ctx context.Context, arg CreateSubscriptionParams) (Subscription, error)
}

// SubscriptionService is consumed by the Handler.
type SubscriptionService interface {
	FindAll(ctx context.Context, userID string) ([]SubscriptionResponseDto, error)
	Subscribe(ctx context.Context, dto CreateSubscriptionDto, userID string) (*SubscriptionResponseDto, error)
}
