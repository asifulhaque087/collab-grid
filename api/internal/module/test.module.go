package module

import (
	"net/http"

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

	svc := auth.NewService(t.AuthRepo)

	handler := auth.NewHandler(svc)

	mux.HandleFunc("POST /users", handler.Register)
}
