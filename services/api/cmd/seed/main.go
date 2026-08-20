package main

import (
	"context"
	"log"
	"time"

	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
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

	enforcer, err := postgresql.InitCasbinEnforcer(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize Casbin enforcer: %v", err)
	}

	// log.Println("Starting database seed job...", enforcer)
	if err := postgresql.Seed(ctx, pool, enforcer); err != nil {
		log.Fatalf("Database seeding failed: %v", err)
	}
	log.Println("Database seeding completed successfully.")
}
