package boards

import "errors"

var (
	ErrBoardNotFound  = errors.New("board not found")
	ErrUnauthorized   = errors.New("unauthorized access")
	ErrInvalidBoardID = errors.New("invalid board id")
	ErrInternalServer = errors.New("an unexpected error occurred")
)
