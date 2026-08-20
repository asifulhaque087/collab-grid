package module

import (
	"log/slog"
	"net/http"

	"github.com/casbin/casbin/v2"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql"
	repo "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
)

type App struct {
	logger   *slog.Logger
	cfg      *config.Config
	pool     *pgxpool.Pool
	enforcer *casbin.Enforcer
}

func NewApp(logger *slog.Logger, cfg *config.Config, pool *pgxpool.Pool, enforcer *casbin.Enforcer) *App {
	return &App{
		logger:   logger,
		cfg:      cfg,
		pool:     pool,
		enforcer: enforcer,
	}
}

func (t *App) RegisterRoute(r chi.Router) {
	queries := repo.New(t.pool)
	uow := postgresql.NewUoW(t.pool)

	authService := auth.NewService(queries, uow, t.logger, t.cfg)
	handler := auth.NewHandler(authService)

	// Grouping under /auth with Chi
	r.Route("/auth", func(r chi.Router) {
		// --- Public Routes ---
		r.Post("/register", handler.Register)
		r.Get("/google", handler.HandleGoogleLogin)
		r.Get("/google/callback", handler.HandleGoogleCallback)

		// --- Protected Routes ---
		r.Group(func(r chi.Router) {
			limitGuard := auth.NewLimitGuard(queries, t.logger)

			r.Use(auth.JWTMiddleware(authService))   // 1st: Inject UserID into context
			r.Use(auth.CasbinMiddleware(t.enforcer)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())           // 3rd: Enforce usage limits

			r.Get("/demo", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"boards": []}`))
			})
		})
	})
}
