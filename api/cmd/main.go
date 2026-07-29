package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	"github.com/asifulhaque087/collab-grid/api/internal/app"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/module"
	"github.com/go-chi/chi/v5"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := postgresql.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close()

	// 1. Create Chi router instead of http.NewServeMux()
	router := chi.NewRouter()

	appModule := module.NewApp(logger, cfg, pool)

	server := app.NewServer(router, appModule)
	server.Start(cfg.Port)
}
