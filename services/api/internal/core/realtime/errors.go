package realtime

import "errors"

var (
	ErrBoardNotFound     = errors.New("board not found")
	ErrBoardNotPublished = errors.New("this board is not published")
	ErrAuthRequired      = errors.New("authentication required")
	ErrInternalServer    = errors.New("internal server error")
)
