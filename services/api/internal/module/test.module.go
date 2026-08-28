package module

import (
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/casbin"
	"github.com/asifulhaque087/loot-board/services/api/internal/config"
	"github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
	"github.com/asifulhaque087/loot-board/services/api/internal/service/auth/middleware"
	auth_mock "github.com/asifulhaque087/loot-board/services/api/internal/service/auth/mock"
	"github.com/go-chi/chi/v5"
)

type TestModule struct {
	AuthRepo       *auth_mock.FakeRepo
	LimitGuardRepo *auth_mock.FakeLimitGuardQueries
	MailRepo       *FakeMailService
	Cfg            *config.Config
	Enforcer       *casbin.CasbinEnforcer
}

type SentMail struct {
	To                string
	Name              string
	ResetURL          string
	ExpirationMinutes int
	Subject           string
}

type FakeMailService struct {
	mu      sync.Mutex
	Records []SentMail
}

func (f *FakeMailService) SendPasswordResetEmail(to string, name string, resetURL string, expirationMinutes int, subject ...string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	subj := ""
	if len(subject) > 0 {
		subj = subject[0]
	}
	f.Records = append(f.Records, SentMail{To: to, Name: name, ResetURL: resetURL, ExpirationMinutes: expirationMinutes, Subject: subj})
	return nil
}

func (f *FakeMailService) LastResetToken() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.Records) == 0 {
		return ""
	}
	raw := f.Records[len(f.Records)-1].ResetURL
	if i := len(raw); i > 0 {
		for idx := len(raw) - 1; idx >= 0; idx-- {
			if raw[idx] == '=' {
				return raw[idx+1:]
			}
		}
	}
	return ""
}

func (f *FakeMailService) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Records = nil
}

func NewTestModule() *TestModule {
	enforcer, err := casbin.InitFakeCasbinEnforcer()
	if err != nil {
		panic("failed to initialize fake casbin enforcer: " + err.Error())
	}

	return &TestModule{
		AuthRepo:       auth_mock.NewFakeRepo(),
		LimitGuardRepo: auth_mock.NewFakeLimitGuardQueries(),
		MailRepo:       &FakeMailService{},
		Cfg: &config.Config{
			Port:                   4000,
			AccessTokenSecret:      "test-access-secret",
			RefreshTokenSecret:     "test-refresh-secret",
			AccessTokenExpiration:  15 * time.Minute,
			RefreshTokenExpiration: 7 * 24 * time.Hour,
			ResetTokenExpiration:   15 * time.Minute,
			ResetPasswordURL:       "http://localhost:3000/reset-password",
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

	svc := auth.NewService(t.AuthRepo, uow, logger, t.Cfg, t.MailRepo, t.Enforcer)
	handler := auth.NewHandler(svc)

	// Mirror app.go route structure
	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			// --- Public Routes ---
			r.Post("/register", handler.Register)
			r.Post("/login", handler.Login)
			r.Post("/forgot-password", handler.ForgotPassword)
			r.Post("/reset-password", handler.ResetPassword)
			r.Post("/refresh", handler.Refresh)

			// --- JWT-only Routes ---
			r.Group(func(r chi.Router) {
				r.Use(middleware.JWTMiddleware(svc, logger))

				r.Get("/me", handler.Me)
				r.Post("/logout", handler.Logout)
			})

			r.Get("/google", handler.HandleGoogleLogin)
			r.Get("/google/callback", handler.HandleGoogleCallback)

			// --- Protected Routes ---
			r.Group(func(r chi.Router) {
				limitGuard := middleware.NewLimitGuard(t.LimitGuardRepo, logger)

				r.Use(middleware.JWTMiddleware(svc, logger))
				r.Use(middleware.CasbinMiddleware(t.Enforcer, logger))
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
	})
}
