// // internal/adapters/postgresql/uow.go
// package postgresql

// import (
// 	"context"
// 	"fmt"

// 	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
// 	"github.com/asifulhaque087/collab-grid/api/internal/domain"
// 	"github.com/jackc/pgx/v5/pgxpool"
// )

// type PgxUnitOfWork struct {
// 	pool *pgxpool.Pool
// }

// func NewUnitOfWork(pool *pgxpool.Pool) *PgxUnitOfWork {
// 	return &PgxUnitOfWork{pool: pool}
// }

// func (u *PgxUnitOfWork) RunInTx(ctx context.Context, fn func(txStores domain.TxStores) error) error {
// 	tx, err := u.pool.Begin(ctx)
// 	if err != nil {
// 		return fmt.Errorf("failed to begin transaction: %w", err)
// 	}

// 	defer func() {
// 		_ = tx.Rollback(ctx)
// 	}()

// 	txStores := domain.TxStores{
// 		Queries: repo.New(tx),
// 	}

// 	if err := fn(txStores); err != nil {
// 		return err
// 	}

// 	return tx.Commit(ctx)
// }

// === New ===

package postgresql

import (
	"context"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/asifulhaque087/collab-grid/api/internal/domain"
)

type UoW struct {
	pool *pgxpool.Pool
}

func NewUoW(pool *pgxpool.Pool) *UoW {
	return &UoW{pool: pool}
}

func (u *UoW) RunInTx(
	ctx context.Context,
	fn func(domain.Stores) error,
) error {
	tx, err := u.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) // no-op if Tx is already committed

	stores := domain.Stores{
		Auth: repo.New(tx), // *pgx.Tx implements repo.DBTX!
	}

	if err := fn(stores); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
