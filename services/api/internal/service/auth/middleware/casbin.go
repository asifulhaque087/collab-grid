package middleware

import (
	"net/http"

	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/go-chi/chi/v5"
)

func CasbinMiddleware(e auth.Enforcer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r.Context())
			if !ok || user.ID == "" {
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
			if err != nil {
				http.Error(w, `{"error": "Internal server authorization error"}`, http.StatusInternalServerError)
				return
			}

			if !allowed {
				http.Error(w, `{"error": "Forbidden: Access denied"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
