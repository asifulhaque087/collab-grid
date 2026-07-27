package postgresql

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool accepts the parent context and database URL from the app config.
func NewPool(ctx context.Context, dbURL string) (*pgxpool.Pool, error) {
	if dbURL == "" {
		return nil, fmt.Errorf("database URL cannot be empty")
	}

	// 1. Enforce a hard startup timeout (e.g., 5 seconds)
	connCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("invalid db url: %w", err)
	}

	// 2. Pass connCtx so connection setup & ping honor the 5s timeout
	pool, err := pgxpool.NewWithConfig(connCtx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(connCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}
