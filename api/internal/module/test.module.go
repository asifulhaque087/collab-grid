package module

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql"
	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/domain"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
	"github.com/casbin/casbin/v2"
	"github.com/go-chi/chi/v5"
)

type TestModule struct {
	AuthRepo         *auth.FakeRepo
	LimitGuardRepo   *auth.FakeLimitGuardQueries
	Cfg              *config.Config
	Enforcer         *casbin.Enforcer
}

func NewTestModule() *TestModule {
	enforcer, err := postgresql.InitFakeCasbinEnforcer()
	if err != nil {
		panic("failed to initialize fake casbin enforcer: " + err.Error())
	}

	return &TestModule{
		AuthRepo:       auth.NewFakeRepo(),
		LimitGuardRepo: auth.NewFakeLimitGuardQueries(),
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

type memUoW struct {
	stores domain.Stores
}

func (m *memUoW) RunInTx(
	_ context.Context, fn func(domain.Stores) error) error {
	return fn(m.stores)
}

func (t *TestModule) RegisterRoute(r chi.Router) {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	stores := domain.Stores{
		Auth: t.AuthRepo,
	}

	uow := &memUoW{
		stores: stores,
	}
	svc := auth.NewService(t.AuthRepo, uow, logger, t.Cfg)
	handler := auth.NewHandler(svc)

	// Mirror app.go route structure
	r.Route("/auth", func(r chi.Router) {
		// --- Public Routes ---
		r.Post("/register", handler.Register)
		r.Get("/google", handler.HandleGoogleLogin)
		r.Get("/google/callback", handler.HandleGoogleCallback)

		// --- Protected Routes ---
		r.Group(func(r chi.Router) {
			limitGuard := auth.NewLimitGuard(t.LimitGuardRepo, logger)

			r.Use(auth.JWTMiddleware(svc))
			r.Use(auth.CasbinMiddleware(t.Enforcer))
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
