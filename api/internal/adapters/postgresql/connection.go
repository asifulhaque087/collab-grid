package postgresql

import (
	"context"
	"fmt"
	"os"
	"time"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultDBURL = "postgres://demo:demo@localhost:5432/demo?sslmode=disable"

// NewPool accepts the parent context from main and enforces a startup timeout.
func NewPool(ctx context.Context) (*pgxpool.Pool, error) {
	dbURL := os.Getenv("GOOSE_DBSTRING")
	if dbURL == "" {
		dbURL = defaultDBURL
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