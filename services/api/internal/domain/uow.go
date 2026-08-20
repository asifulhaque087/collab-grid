package domain

import (
	"context"
)

// checkout/checkout.go

type Stores struct {
	Auth AuthRepo
}

type UnitOfWork interface {
	// RunInTx runs fn inside a single transaction. Every store
	// in the Stores value executes against that transaction.
	RunInTx(ctx context.Context, fn func(Stores) error) error
}
