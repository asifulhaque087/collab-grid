package order

import "errors"

var (
	ErrOrderNotFound      = errors.New("order not found")
	ErrBoardNotFound      = errors.New("board not found")
	ErrInvalidOrderID     = errors.New("invalid order id")
	ErrInvalidBoardID     = errors.New("invalid board id")
	ErrInvalidWidgetID    = errors.New("invalid widget id")
	ErrItemsUnavailable   = errors.New("some items are no longer available")
	ErrReservationExpired = errors.New("reservation expired — please lock the items again")
	ErrInternalServer     = errors.New("an unexpected error occurred")
)
