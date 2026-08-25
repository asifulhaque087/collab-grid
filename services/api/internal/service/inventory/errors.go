package inventory

import "errors"

var (
	ErrItemNotFound   = errors.New("inventory item not found")
	ErrBoardNotFound  = errors.New("board not found")
	ErrInvalidItemID  = errors.New("invalid inventory item id")
	ErrInvalidBoardID = errors.New("invalid board id")
	ErrInvalidPrice   = errors.New("invalid price value")
	ErrInvalidCsvFile = errors.New("CSV file has no valid rows.")
	ErrUnauthorized   = errors.New("unauthorized access")
	ErrInternalServer = errors.New("an unexpected error occurred")
)
