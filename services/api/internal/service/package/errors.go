package pkg

import "errors"

var (
	ErrPackageNotFound   = errors.New("package not found")
	ErrInvalidPackageID  = errors.New("invalid package id")
	ErrInvalidPermission = errors.New("invalid permission id")
	ErrSystemPackage     = errors.New("system packages cannot be deleted")
	ErrUnauthorized      = errors.New("unauthorized access")
	ErrInternalServer    = errors.New("an unexpected error occurred")
)
