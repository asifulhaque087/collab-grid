package module

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/repo"
	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/uow"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/asifulhaque087/collab-grid/services/api/internal/mail"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	logger   *slog.Logger
	cfg      *config.Config
	pool     *pgxpool.Pool
	enforcer auth.Enforcer
}

func NewApp(logger *slog.Logger, cfg *config.Config, pool *pgxpool.Pool, enforcer auth.Enforcer) *App {
	return &App{
		logger:   logger,
		cfg:      cfg,
		pool:     pool,
		enforcer: enforcer,
	}
}

func (t *App) RegisterRoute(r chi.Router) {
	queries := sqlc.New(t.pool)
	authRepo := repo.NewAuthRepository(t.pool)
	uow := uow.NewAuthUoW(t.pool)

	mailer := mail.NewMailer(mail.SMTPConfig{
		Host:     t.cfg.SMTPHost,
		Port:     fmt.Sprintf("%d", t.cfg.SMTPPort),
		Username: t.cfg.SMTPUser,
		Password: t.cfg.SMTPPass,
		From:     t.cfg.MailFrom,
	})
	mailSvc := mail.NewProvider(mailer)

	authService := auth.NewService(authRepo, uow, t.logger, t.cfg, mailSvc)
	handler := auth.NewHandler(authService)

	// health route
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Backend is healthy"))
	})

	// Grouping under /auth with Chi
	r.Route("/auth", func(r chi.Router) {
		// --- Public Routes ---
		r.Post("/register", handler.Register)
		r.Post("/login", handler.Login)
		r.Post("/forgot-password", handler.ForgotPassword)
		r.Post("/reset-password", handler.ResetPassword)
		r.Post("/refresh", handler.Refresh)

		// --- JWT-only Routes ---
		r.Group(func(r chi.Router) {
			r.Use(middleware.JWTMiddleware(authService))

			r.Get("/me", handler.Me)
			r.Post("/logout", handler.Logout)
		})

		r.Get("/google", handler.HandleGoogleLogin)
		r.Get("/google/callback", handler.HandleGoogleCallback)

		// --- Protected Routes ---
		r.Group(func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                 // 3rd: Enforce usage limits

			r.Get("/demo", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"boards": []}`))
			})
		})
	})
}
