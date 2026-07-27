package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/module"
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

	// 1. Root context bound to app lifecycle signals
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 2. Database pool initialized at root level
	pool, err := postgresql.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close() // Properly closes when the app shuts down!

	mux := http.NewServeMux()

	// 3. Inject pool into application module
	appModule := module.NewApp(logger, cfg, pool)
	appModule.RegisterRoute(mux)

	// ... Start HTTP server using context
}
