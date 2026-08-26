package subscription

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// Package is the subset of package data the subscription service consumes.
type Package struct {
	ID    pgtype.UUID
	Slug  string
	Title string
}

// Subscription is a user's subscription joined with its package details.
type Subscription struct {
	ID            pgtype.UUID
	PackageID     pgtype.UUID
	PackageTitle  string
	PackageSlug   string
	StartDate     pgtype.Timestamp
	EndDate       pgtype.Timestamp
	PaymentMethod string
	Amount        pgtype.Numeric
}

// CreateSubscriptionParams carries the values required to insert a subscription.
type CreateSubscriptionParams struct {
	UserID        pgtype.UUID
	PackageID     pgtype.UUID
	StartDate     pgtype.Timestamp
	EndDate       pgtype.Timestamp
	PaymentMethod string
	Amount        pgtype.Numeric
}

// SubscriptionResponseDto is the JSON shape returned to API clients.
type SubscriptionResponseDto struct {
	ID            string     `json:"id"`
	PackageID     string     `json:"packageId"`
	PackageTitle  string     `json:"packageTitle"`
	PackageSlug   string     `json:"packageSlug"`
	StartDate     time.Time  `json:"startDate"`
	EndDate       *time.Time `json:"endDate"`
	PaymentMethod string     `json:"paymentMethod"`
	Amount        string     `json:"amount"`
}
