package role

type CreateRoleRequestDto struct {
	Name          string   `json:"name" validate:"required"`
	PermissionIDs []string `json:"permissionIds" validate:"omitempty,dive,uuid"`
}

type UpdateRoleRequestDto struct {
	Name          *string   `json:"name,omitempty" validate:"omitempty,min=1"`
	PermissionIDs *[]string `json:"permissionIds,omitempty" validate:"omitempty,dive,uuid"`
}

type PermissionResponseDto struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Action      string  `json:"action"`
	Subject     string  `json:"subject"`
	Description *string `json:"description,omitempty"`
}

type RoleResponseDto struct {
	ID              string                  `json:"id"`
	Slug            string                  `json:"slug"`
	Title           string                  `json:"title"`
	PrimaryUserID   *string                 `json:"primaryUserId,omitempty"`
	SecondaryUserID *string                 `json:"secondaryUserId,omitempty"`
	MemberCount     int64                   `json:"memberCount"`
	Permissions     []PermissionResponseDto `json:"permissions"`
}
