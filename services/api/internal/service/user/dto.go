package user

type CreateUserRequestDto struct {
	Name     string   `json:"name" validate:"required"`
	Email    string   `json:"email" validate:"required,email"`
	Password string   `json:"password" validate:"required"`
	RoleIds  []string `json:"roleIds" validate:"omitempty,dive,uuid"`
}

type UpdateUserRequestDto struct {
	Name     *string   `json:"name,omitempty" validate:"omitempty,min=1"`
	Email    *string   `json:"email,omitempty" validate:"omitempty,email"`
	Password *string   `json:"password,omitempty" validate:"omitempty,min=1"`
	RoleIds  *[]string `json:"roleIds,omitempty" validate:"omitempty,dive,uuid"`
}

type UserRoleResponseDto struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Slug  string `json:"slug"`
}

type UserResponseDto struct {
	ID       string                `json:"id"`
	Name     string                `json:"name"`
	Email    string                `json:"email"`
	Provider *string               `json:"provider"`
	Roles    []UserRoleResponseDto `json:"roles"`
}
