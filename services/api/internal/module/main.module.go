package module

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/casbin"
	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/repo"
	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/uow"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/asifulhaque087/collab-grid/services/api/internal/mail"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth/middleware"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/boards"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/inventory"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/order"
	pkg "github.com/asifulhaque087/collab-grid/services/api/internal/service/package"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/role"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/user"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	logger   *slog.Logger
	cfg      *config.Config
	pool     *pgxpool.Pool
	enforcer *casbin.CasbinEnforcer
}

func NewApp(logger *slog.Logger, cfg *config.Config, pool *pgxpool.Pool, enforcer *casbin.CasbinEnforcer) *App {
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

	authService := auth.NewService(authRepo, uow, t.logger, t.cfg, mailSvc, t.enforcer)
	handler := auth.NewHandler(authService)

	boardRepo := repo.NewBoardRepository(t.pool)
	boardSvc := boards.NewService(boardRepo, t.logger)
	boardHandler := boards.NewHandler(boardSvc)

	inventoryRepo := repo.NewInventoryRepository(t.pool)
	inventorySvc := inventory.NewService(inventoryRepo, t.logger)
	inventoryHandler := inventory.NewHandler(inventorySvc)

	roleRepo := repo.NewRoleRepository(t.pool)
	roleSvc := role.NewService(roleRepo, t.enforcer, t.logger)
	roleHandler := role.NewHandler(roleSvc)

	userRepo := repo.NewUserRepository(t.pool)
	userSvc := user.NewService(userRepo, t.logger)
	userHandler := user.NewHandler(userSvc)

	orderRepo := repo.NewOrderRepository(t.pool)
	orderGateway := order.NewPermissiveGateway()
	orderSvc := order.NewService(orderRepo, orderGateway, mailSvc, t.logger)
	orderHandler := order.NewHandler(orderSvc)

	packageRepo := repo.NewPackageRepository(t.pool)
	packageSvc := pkg.NewService(packageRepo, t.logger)
	packageHandler := pkg.NewHandler(packageSvc)

	// health route
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Backend is healthy"))
	})

	r.Route("/api/v1", func(r chi.Router) {
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
				r.Use(middleware.JWTMiddleware(authService, t.logger))

				r.Get("/me", handler.Me)
				r.Post("/logout", handler.Logout)
			})

			r.Get("/google", handler.HandleGoogleLogin)
			r.Get("/google/callback", handler.HandleGoogleCallback)

			// --- Protected Routes ---
			r.Group(func(r chi.Router) {
				limitGuard := middleware.NewLimitGuard(queries, t.logger)

				r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
				r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
				r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

				r.Get("/demo", func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.Write([]byte(`{"boards": []}`))
				})
			})
		})

		// Grouping under /boards with Chi (JWT + Casbin + LimitGuard)
		r.Route("/boards", func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

			r.Get("/", boardHandler.FindAll)
			r.Post("/", boardHandler.Create)
			r.Get("/by-slug/{slug}", boardHandler.FindBySlug)
			r.Patch("/{id}", boardHandler.Update)
			r.Delete("/{id}", boardHandler.Remove)
		})

		// Grouping under /inventory with Chi (JWT + Casbin + LimitGuard)
		r.Route("/inventory", func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

			r.Get("/", inventoryHandler.FindAll)
			r.Post("/", inventoryHandler.Create)
			r.Post("/import", inventoryHandler.ImportCsv)
			r.Patch("/{id}", inventoryHandler.Update)
			r.Delete("/{id}", inventoryHandler.Remove)
		})

		// Grouping under /roles with Chi (JWT + Casbin + LimitGuard)
		r.Route("/roles", func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

			r.Get("/permissions", roleHandler.ListPermissions)
			r.Get("/", roleHandler.FindAll)
			r.Post("/", roleHandler.Create)
			r.Patch("/{id}", roleHandler.Update)
			r.Delete("/{id}", roleHandler.Remove)
		})

		// Grouping under /users with Chi (JWT + Casbin + LimitGuard)
		r.Route("/users", func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

			r.Get("/", userHandler.FindAll)
			r.Post("/", userHandler.Create)
			r.Patch("/{id}", userHandler.Update)
			r.Delete("/{id}", userHandler.Remove)
		})

		// Grouping under /orders. Checkout (POST /) and invoice viewing are
		// public — anonymous buyers; the unguessable order UUID gates access.
		// Only the tenant-scoped listing requires JWT + Casbin + LimitGuard.
		r.Route("/orders", func(r chi.Router) {
			r.Post("/", orderHandler.Create)
			r.Get("/{id}/invoice", orderHandler.Invoice)

			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Group(func(r chi.Router) {
				r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
				r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
				r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

				r.Get("/", orderHandler.FindAll)
			})
		})

		// Grouping under /packages with Chi (JWT + Casbin + LimitGuard)
		r.Route("/packages", func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

			r.Get("/permissions", packageHandler.ListPermissions)
			r.Get("/", packageHandler.FindAll)
			r.Post("/", packageHandler.Create)
			r.Patch("/{id}", packageHandler.Update)
			r.Delete("/{id}", packageHandler.Remove)
		})
	})
}
