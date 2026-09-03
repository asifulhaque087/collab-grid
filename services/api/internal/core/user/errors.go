package user

import "errors"

var (
	ErrUserNotFound   = errors.New("user not found")
	ErrInvalidUserID  = errors.New("invalid user id")
	ErrInvalidRoleID  = errors.New("invalid role id")
	ErrUnauthorized   = errors.New("unauthorized access")
	ErrInternalServer = errors.New("an unexpected error occurred")
)
