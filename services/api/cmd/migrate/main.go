package main

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func main() {
	// Load configuration using the central config package
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// 1. Ensure the target database exists
	if err := ensureDatabaseExists(cfg.DatabaseURL); err != nil {
		log.Fatalf("Database initialization check failed: %v", err)
	}

	// 2. Open connection to the application database
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to open DB connection: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping DB: %v", err)
	}

	// 3. Configure Goose
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("failed to set goose dialect: %v", err)
	}

	goose.SetBaseFS(postgresql.EmbedMigrations)

	// 4. Run migrations
	log.Println("Applying database migrations...")
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	log.Println("Database migrations applied successfully!")
}

func ensureDatabaseExists(dbURL string) error {
	// Parse the connection string using pgx.ParseConfig
	pgConfig, err := pgx.ParseConfig(dbURL)
	if err != nil {
		return fmt.Errorf("failed to parse database URL: %w", err)
	}

	targetDB := pgConfig.Database
	if targetDB == "" || targetDB == "postgres" {
		return nil
	}

	// Override database name to default "postgres" system database
	pgConfig.Database = "postgres"
	adminDSN := pgConfig.ConnString() // ConnString() renders the updated DSN

	adminDB, err := sql.Open("pgx", adminDSN)
	if err != nil {
		return fmt.Errorf("failed to connect to admin database: %w", err)
	}
	defer adminDB.Close()

	if err := adminDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping admin database: %w", err)
	}

	// Check if target database exists
	var exists bool
	query := "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)"
	if err := adminDB.QueryRow(query, targetDB).Scan(&exists); err != nil {
		return fmt.Errorf("failed to check database existence: %w", err)
	}

	if !exists {
		log.Printf("Database %q does not exist. Creating...", targetDB)
		createStmt := fmt.Sprintf("CREATE DATABASE %q", targetDB)
		if _, err := adminDB.Exec(createStmt); err != nil {
			return fmt.Errorf("failed to create database %q: %w", targetDB, err)
		}
		log.Printf("Database %q created successfully.", targetDB)
	}

	return nil
}
