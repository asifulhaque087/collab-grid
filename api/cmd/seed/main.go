package main

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
)

func main() {

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	log.Println("Starting database seed job...")
	if err := postgresql.Seed(ctx, pool); err != nil {
		log.Fatalf("Database seeding failed: %v", err)
	}
	log.Println("Database seeding completed successfully.")
}
