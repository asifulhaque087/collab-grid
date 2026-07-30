// internal/service/auth/middleware.go
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/casbin/casbin/v2"
	"github.com/go-chi/chi/v5"
)

type contextKey string

const (
	UserContextKey contextKey = "user_claims" // Stores the entire *JwtPayload
)

func GetUserFromContext(ctx context.Context) (*JwtPayload, bool) {
	user, ok := ctx.Value(UserContextKey).(*JwtPayload)
	return user, ok
}

// JWTMiddleware extracts the JWT token, validates it, and injects user_id into context

func JWTMiddleware(authService *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error": "Unauthorized: Missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, `{"error": "Unauthorized: Invalid header format"}`, http.StatusUnauthorized)
				return
			}

			// Extract claims from token
			claims, err := authService.ValidateAccessToken(parts[1])
			if err != nil {
				http.Error(w, `{"error": "Unauthorized: Invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			// Pass ID into request context for Casbin and downstream handlers
			ctx := context.WithValue(r.Context(), UserContextKey, claims.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// CasbinMiddleware verifies access using user_id from context, path (obj), and method (act)
func CasbinMiddleware(e *casbin.Enforcer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r.Context())
			if !ok || user.ID == "" {
				http.Error(w, `{"error": "Unauthorized: User not identified"}`, http.StatusUnauthorized)
				return
			}
			tenantId := user.PrimaryUserID ?

			rctx := chi.RouteContext(r.Context())
			pattern := rctx.RoutePattern()

			if pattern == "" {
				pattern = r.URL.Path // Fallback if no pattern matched
			}

			method := r.Method

			// Enforce against casbin_rule table loaded in memory
			allowed, err := e.Enforce(user.ID, pattern, method)
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

func LimitMiddleware(authService *Service) func(http.Handler) http.Handler {

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			rctx := chi.RouteContext(r.Context())
			pattern := rctx.RoutePattern()

			if pattern == "" {
				pattern = r.URL.Path // Fallback if no pattern matched
			}

			method := r.Method

			if method == "POST" {

			} else if method == "DELETE" {

			}

		})
	}

}
