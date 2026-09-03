package subscription

type CreateSubscriptionDto struct {
	PackageSlug   string `json:"packageSlug" validate:"required"`
	DurationMonth int    `json:"durationMonth" validate:"required,min=1"`
}
