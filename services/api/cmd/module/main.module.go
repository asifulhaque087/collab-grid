package module

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/asifulhaque087/loot-board/services/api/config"
	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/casbin"
	smpt "github.com/asifulhaque087/loot-board/services/api/internal/adapters/mail/smtp"
	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/repo"
	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/uow"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth/middleware"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/boards"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/inventory"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/order"
	pkg "github.com/asifulhaque087/loot-board/services/api/internal/core/package"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/realtime"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/role"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/subscription"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/user"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
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

	mailer := smpt.NewMailer(smpt.SMTPMailerConfig{
		Host:     t.cfg.SMTPHost,
		Port:     fmt.Sprintf("%d", t.cfg.SMTPPort),
		Username: t.cfg.SMTPUser,
		Password: t.cfg.SMTPPass,
		From:     t.cfg.MailFrom,
	})

	// authService := auth.NewService(authRepo, uow, t.logger, t.cfg, mailSvc, t.enforcer)
	authService := auth.NewService(authRepo, uow, t.logger, t.cfg, mailer, t.enforcer)
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

	packageRepo := repo.NewPackageRepository(t.pool)
	packageSvc := pkg.NewService(packageRepo, t.logger)
	packageHandler := pkg.NewHandler(packageSvc)

	subscriptionRepo := repo.NewSubscriptionRepository(t.pool)
	subscriptionSvc := subscription.NewService(subscriptionRepo, t.logger)
	subscriptionHandler := subscription.NewHandler(subscriptionSvc)

	// ── Realtime (websocket canvas) ──────────────────────────
	rdbOpts, err := redis.ParseURL(t.cfg.RedisURL)
	if err != nil {
		rdbOpts = &redis.Options{Addr: t.cfg.RedisURL}
	}
	rdb := redis.NewClient(rdbOpts)

	rabbit := realtime.NewRabbitmqService(t.cfg.RabbitMQURL, t.logger)
	rabbit.Connect()

	realtimeRepo := repo.NewRealtimeRepository(t.pool)
	zone := realtime.NewZoneService()
	socketAuth := realtime.NewSocketAuthService(realtimeRepo, t.cfg.WSTokenSecret)
	hub := realtime.NewHub(rdb, t.logger)
	realtimeSvc := realtime.NewService(realtimeRepo, rdb, t.cfg.WSTokenSecret, t.logger, hub)
	gateway := realtime.NewRealtimeGateway(hub, realtimeSvc, zone, socketAuth, rabbit, t.logger)
	consumer := realtime.NewWidgetPersistenceConsumer(rabbit, realtimeRepo, t.logger)

	// Background workers: cross-instance broadcast backplane, Redis keyspace
	// expiry → lock auto-release, and durable widget-position persistence.
	go hub.StartBackplane(context.Background())
	go realtimeSvc.StartExpiryWatcher(context.Background())
	go consumer.Start(context.Background())

	tokenExchangeHandler := realtime.NewTokenExchangeHandler(socketAuth)

	// The realtime service drives lock release + widget removal when an order is
	// paid, broadcasting the changes to every connected canvas socket.
	orderGateway := order.RealtimeGateway(realtimeSvc)
	orderSvc := order.NewService(orderRepo, orderGateway, mailer, t.logger)
	orderHandler := order.NewHandler(orderSvc)

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

			r.Get("/public/{slug}", boardHandler.FindPublicBySlug)

			r.Group(func(r chi.Router) {

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

		// Grouping under /subscriptions with Chi (JWT + Casbin + LimitGuard)
		r.Route("/subscriptions", func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(queries, t.logger)

			r.Use(middleware.JWTMiddleware(authService, t.logger))   // 1st: Inject UserID into context
			r.Use(middleware.CasbinMiddleware(t.enforcer, t.logger)) // 2nd: Enforce authorization
			r.Use(limitGuard.Middleware())                           // 3rd: Enforce usage limits

			r.Get("/", subscriptionHandler.FindAll)
			r.Post("/", subscriptionHandler.Subscribe)
		})

		// Realtime websocket canvas — public upgrade; the socket authenticates
		// itself via the query-param `token` from the token-exchange endpoint.
		r.Get("/realtime/canvas", gateway.ServeWS)

		// Realtime token exchange — JWT only (no Casbin), mirrors the legacy
		// AccessTokenGuard on the NestJS controller.
		r.Route("/realtime", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.JWTMiddleware(authService, t.logger))
				r.Post("/token-exchange", tokenExchangeHandler.Exchange)
			})
		})
	})
}
