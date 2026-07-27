package module

import (
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
)

type TestModule struct {
	AuthRepo *auth.FakeRepo
}

func NewTestModule() *TestModule {
	return &TestModule{
		AuthRepo: auth.NewFakeRepo(),
	}
}

func (t *TestModule) RegisterRoute(mux *http.ServeMux) {

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	svc := auth.NewService(t.AuthRepo, logger, cfg)

	handler := auth.NewHandler(svc)

	mux.HandleFunc("POST /users", handler.Register)
}
