package module

import (
	"log/slog"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	logger *slog.Logger
	cfg    *config.Config
	pool   *pgxpool.Pool
}

func NewApp(logger *slog.Logger, cfg *config.Config, pool *pgxpool.Pool) *App {
	return &App{
		logger: logger,
		cfg:    cfg,
		pool:   pool,
	}
}

func (t *App) RegisterRoute(r chi.Router) {
	queries := repo.New(t.pool)
	uow := postgresql.NewUoW(t.pool)

	authService := auth.NewService(queries, uow, t.logger, t.cfg)
	handler := auth.NewHandler(authService)

	// Grouping under /auth with Chi
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", handler.Register)
		r.Get("/google", handler.HandleGoogleLogin)
		r.Get("/google/callback", handler.HandleGoogleCallback)
	})
}
