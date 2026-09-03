package pkg

type CreatePackagePermissionDto struct {
	PermissionID string `json:"permissionId" validate:"required,uuid"`
	Limit        *int32 `json:"limit"`
}

type CreatePackageRequestDto struct {
	Name        string                       `json:"name" validate:"required"`
	Price       string                       `json:"price" validate:"required"`
	Permissions []CreatePackagePermissionDto `json:"permissions" validate:"omitempty,dive"`
}

type UpdatePackagePermissionDto struct {
	PermissionID string `json:"permissionId" validate:"required,uuid"`
	Limit        *int32 `json:"limit"`
}

type UpdatePackageRequestDto struct {
	Name        *string                       `json:"name,omitempty" validate:"omitempty,min=1"`
	Price       *string                       `json:"price,omitempty"`
	Permissions *[]UpdatePackagePermissionDto `json:"permissions,omitempty" validate:"omitempty,dive"`
}

type PermissionResponseDto struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Action      string  `json:"action"`
	Subject     string  `json:"subject"`
	Description *string `json:"description,omitempty"`
}

type PackagePermissionResponseDto struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Action  string `json:"action"`
	Subject string `json:"subject"`
	Limit   *int32 `json:"limit"`
}

type PackageResponseDto struct {
	ID              string                         `json:"id"`
	Slug            string                         `json:"slug"`
	Title           string                         `json:"title"`
	Price           string                         `json:"price"`
	PrimaryUserID   *string                        `json:"primaryUserId,omitempty"`
	SecondaryUserID *string                        `json:"secondaryUserId,omitempty"`
	IsSystem        bool                           `json:"isSystem"`
	SubscriberCount int64                          `json:"subscriberCount"`
	Permissions     []PackagePermissionResponseDto `json:"permissions"`
}

type PublicPackageFeatureDto struct {
	Value string `json:"value"`
	Text  string `json:"text"`
}

type PublicPackageDto struct {
	ID           string                    `json:"id"`
	Slug         string                    `json:"slug"`
	Title        string                    `json:"title"`
	Price        string                    `json:"price"`
	MonthlyPrice int                       `json:"monthlyPrice"`
	Featured     bool                      `json:"featured"`
	Features     []PublicPackageFeatureDto `json:"features"`
}
