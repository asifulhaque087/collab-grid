package module

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/domain"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
)

type TestModule struct {
	AuthRepo *auth.FakeRepo
	Cfg      *config.Config
}

func NewTestModule() *TestModule {
	return &TestModule{
		AuthRepo: auth.NewFakeRepo(),
		Cfg: &config.Config{
			Port:                   4000,
			AccessTokenSecret:      "test-access-secret",
			RefreshTokenSecret:     "test-refresh-secret",
			AccessTokenExpiration:  15 * time.Minute,
			RefreshTokenExpiration: 7 * 24 * time.Hour,
			// Add any other config fields required by auth.NewService
		},
	}
}

type memUoW struct {
	stores domain.Stores
}

func (m *memUoW) RunInTx(
	_ context.Context, fn func(domain.Stores) error) error {
	return fn(m.stores)
}

func (t *TestModule) RegisterRoute(mux *http.ServeMux) {

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	stores := domain.Stores{
		Auth: t.AuthRepo, // map your repo(s) here depending on domain.Stores definition
	}

	// 2. Initialize your memory Unit of Work instance
	uow := &memUoW{
		stores: stores,
	}
	svc := auth.NewService(t.AuthRepo, uow, logger, t.Cfg)

	handler := auth.NewHandler(svc)

	mux.HandleFunc("POST /users", handler.Register)
}
