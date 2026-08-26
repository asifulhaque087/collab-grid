package subscription

import (
	"errors"
)

var (
	ErrInvalidUserID         = errors.New("invalid user id")
	ErrPackageNotFound       = errors.New("package not found")
	ErrAlreadySubscribedFree = errors.New("you are already subscribed to the Free package")
	ErrInternalServer        = errors.New("an unexpected error occurred")
)
