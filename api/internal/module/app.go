package module

import (
	"log/slog"
	"net/http"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
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

func (t *App) RegisterRoute(mux *http.ServeMux) {
	// 1. Initialize Store instead of bare repo.Queries
	// store := postgresql.NewStore(t.pool)

	queries := repo.New(t.pool)
	uow := postgresql.NewUoW(t.pool)

	// 2. Pass store directly into NewService
	// Since *Store implements GetUserByEmail, CreateUser, and ExecTx,
	// it automatically satisfies the auth.AuthRepo interface!
	authService := auth.NewService(queries, uow, t.logger, t.cfg)

	handler := auth.NewHandler(authService)

	mux.HandleFunc("POST /auth/register", handler.Register)
	mux.HandleFunc("GET /auth/google", handler.HandleGoogleLogin)
	mux.HandleFunc("GET /auth/google/callback", handler.HandleGoogleCallback)
}
