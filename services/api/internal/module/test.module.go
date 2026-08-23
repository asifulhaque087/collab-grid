package module

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/asifulhaque087/collab-grid/services/api/internal/adapters/casbin"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth/middleware"
	auth_mock "github.com/asifulhaque087/collab-grid/services/api/internal/service/auth/mock"
	"github.com/go-chi/chi/v5"
)

type TestModule struct {
	AuthRepo       *auth_mock.FakeRepo
	LimitGuardRepo *auth_mock.FakeLimitGuardQueries
	Cfg            *config.Config
	Enforcer       *casbin.CasbinEnforcer
}

func NewTestModule() *TestModule {
	enforcer, err := casbin.InitFakeCasbinEnforcer()
	if err != nil {
		panic("failed to initialize fake casbin enforcer: " + err.Error())
	}

	return &TestModule{
		AuthRepo:       auth_mock.NewFakeRepo(),
		LimitGuardRepo: auth_mock.NewFakeLimitGuardQueries(),
		Cfg: &config.Config{
			Port:                   4000,
			AccessTokenSecret:      "test-access-secret",
			RefreshTokenSecret:     "test-refresh-secret",
			AccessTokenExpiration:  15 * time.Minute,
			RefreshTokenExpiration: 7 * 24 * time.Hour,
		},
		Enforcer: enforcer,
	}
}

func (t *TestModule) RegisterRoute(r chi.Router) {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	stores := auth.Stores{
		Auth: t.AuthRepo,
	}

	uow := auth_mock.NewMemUoW(stores)

	svc := auth.NewService(t.AuthRepo, uow, logger, t.Cfg)
	handler := auth.NewHandler(svc)

	// Mirror app.go route structure
	r.Route("/auth", func(r chi.Router) {
		// --- Public Routes ---
		r.Post("/register", handler.Register)
		r.Post("/login", handler.Login)
		r.Get("/google", handler.HandleGoogleLogin)
		r.Get("/google/callback", handler.HandleGoogleCallback)

		// --- Protected Routes ---
		r.Group(func(r chi.Router) {
			limitGuard := middleware.NewLimitGuard(t.LimitGuardRepo, logger)

			r.Use(middleware.JWTMiddleware(svc))
			r.Use(middleware.CasbinMiddleware(t.Enforcer))
			r.Use(limitGuard.Middleware())

			r.Get("/demo", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"boards": []}`))
			})

			r.Post("/demo", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"created": true}`))
			})

			r.Delete("/demo", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"deleted": true}`))
			})
		})
	})
}
