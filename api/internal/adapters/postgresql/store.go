package postgresql

import (
	"context"
	"fmt"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
	*repo.Queries
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{
		pool:    pool,
		Queries: repo.New(pool),
	}
}

// ExecTx executes a function within a database transaction
func (s *Store) ExecTx(ctx context.Context, fn func(*repo.Queries) error) error {
	// 1. Begin transaction on the pool
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}

	// 2. Ensure rollback if an error occurs or panic happens before commit
	// (Rollback is a no-op if tx.Commit has already succeeded)
	defer tx.Rollback(ctx)

	// 3. Create a transaction-aware *repo.Queries instance
	qtx := s.Queries.WithTx(tx)

	// 4. Run the callback containing your business queries
	if err := fn(qtx); err != nil {
		return err // tx.Rollback will execute via defer
	}

	// 5. If callback returns nil, commit the transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit tx: %w", err)
	}

	return nil
}
