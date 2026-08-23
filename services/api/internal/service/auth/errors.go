package auth

import "errors"

var (
	ErrEmailConflict      = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInternalServer     = errors.New("an unexpected error occurred")
)
