package module

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
)

type App struct{}

func NewApp() *App {
	return &App{}
}

func (t *App) RegisterRoute(mux *http.ServeMux) {

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := postgresql.NewPool(ctx)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close()

	queries := repo.New(pool)

	// Auth
	authService := auth.NewService(queries)

	handler := auth.NewHandler(authService)

	mux.HandleFunc("POST /users", handler.Register)
}
