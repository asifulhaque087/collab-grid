package middleware

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	auth "github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/go-chi/chi/v5"
)

type fakeEnforcer struct {
	rules map[string]bool
}

func (f *fakeEnforcer) Enforce(sub, obj, act string) (bool, error) {
	return f.rules[sub+"|"+obj+"|"+act], nil
}

func (f *fakeEnforcer) AddGroupingPolicy(params ...interface{}) (bool, error) {
	return true, nil
}

const testTenantID = "11111111-1111-1111-1111-111111111111"

// runThroughCasbin mirrors the production route mounting and middleware chain.
func runThroughCasbin(rules map[string]bool, method, target string) int {
	r := chi.NewRouter()
	r.Route("/api/v1/boards", func(r chi.Router) {
		logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
		r.Use(CasbinMiddleware(&fakeEnforcer{rules: rules}, logger))
		r.Get("/", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
		r.Post("/", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
		r.Patch("/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	})

	req := httptest.NewRequest(method, target, nil)
	ctx := context.WithValue(req.Context(), auth.UserContextKey, &auth.JwtPayload{ID: testTenantID})
	req = req.WithContext(ctx)

	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	return res.Code
}

func TestCasbinMiddlewareAllowsExactPolicyMatch(t *testing.T) {
	// Seeded policy shape: p(role, /api/v1/boards, POST)
	rules := map[string]bool{
		testTenantID + "|/api/v1/boards|POST": true,
	}

	if got := runThroughCasbin(rules, http.MethodPost, "/api/v1/boards"); got != http.StatusOK {
		t.Errorf("expected 200 for exact policy match, got %d", got)
	}
}

func TestCasbinMiddlewareFallsBackToTrailingSlashForWildcardPolicies(t *testing.T) {
	// Seeded policy shape: p(role, /api/v1/boards/*, GET). chi resolves the
	// collection pattern without a trailing slash, so enforcement must retry
	// with one appended to satisfy keyMatch2 against the wildcard.
	rules := map[string]bool{
		testTenantID + "|/api/v1/boards/|GET": true,
	}

	if got := runThroughCasbin(rules, http.MethodGet, "/api/v1/boards"); got != http.StatusOK {
		t.Errorf("expected 200 for wildcard policy via trailing-slash fallback, got %d", got)
	}
}

func TestCasbinMiddlewareDeniesWithoutPolicy(t *testing.T) {
	if got := runThroughCasbin(map[string]bool{}, http.MethodPost, "/api/v1/boards"); got != http.StatusForbidden {
		t.Errorf("expected 403 without matching policy, got %d", got)
	}
}
