package auth

import "errors"

var (
	ErrEmailConflict       = errors.New("email already registered")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrInvalidResetToken   = errors.New("invalid or expired reset token")
	ErrUnauthorized        = errors.New("unauthorized access")
	ErrInternalServer      = errors.New("an unexpected error occurred")
)
