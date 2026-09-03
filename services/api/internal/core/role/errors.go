package role

import "errors"

var (
	ErrRoleNotFound      = errors.New("role not found")
	ErrInvalidRoleID     = errors.New("invalid role id")
	ErrInvalidPermission = errors.New("invalid permission id")
	ErrUnauthorized      = errors.New("unauthorized access")
	ErrInternalServer    = errors.New("an unexpected error occurred")
)
