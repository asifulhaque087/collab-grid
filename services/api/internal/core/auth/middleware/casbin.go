package middleware

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth"
	"github.com/go-chi/chi/v5"
)

func CasbinMiddleware(e auth.Enforcer, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.GetUserFromContext(r.Context())
			if !ok || user.ID == "" {
				logger.Warn("casbin authorization failed",
					slog.String("path", r.URL.Path),
					slog.String("method", r.Method),
					slog.String("reason", "user not identified"),
				)
				http.Error(w, `{"error": "Unauthorized: User not identified"}`, http.StatusUnauthorized)
				return
			}

			var tenantID string
			if user.PrimaryUserID != "" {
				tenantID = user.PrimaryUserID
			} else {
				tenantID = user.ID
			}

			rctx := chi.RouteContext(r.Context())
			pattern := rctx.RoutePattern()

			if pattern == "" {
				pattern = r.URL.Path
			}

			method := r.Method

			allowed, err := e.Enforce(tenantID, pattern, method)
			if err == nil && !allowed && !strings.HasSuffix(pattern, "/") {
				// Collection routes resolve without a trailing slash (e.g. /api/v1/boards),
				// but seeded wildcard policies expect one (/api/v1/boards/*). Retry with
				// the trailing slash so GET collections match wildcard policies.
				allowed, err = e.Enforce(tenantID, pattern+"/", method)
			}
			if err != nil {
				logger.Error("casbin enforcement failed",
					slog.String("tenant_id", tenantID),
					slog.String("pattern", pattern),
					slog.String("method", method),
					slog.String("error", err.Error()),
				)
				http.Error(w, `{"error": "Internal server authorization error"}`, http.StatusInternalServerError)
				return
			}

			if !allowed {
				logger.Warn("casbin access denied",
					slog.String("tenant_id", tenantID),
					slog.String("pattern", pattern),
					slog.String("method", method),
				)
				http.Error(w, `{"error": "Forbidden: Access denied"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
