package auth

import "errors"

var (
	ErrEmailConflict  = errors.New("email already registered")
	ErrInternalServer = errors.New("an unexpected error occurred")
)
