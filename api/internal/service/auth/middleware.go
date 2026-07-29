// internal/service/auth/middleware.go
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/casbin/casbin/v2"
)

type contextKey string

const UserIDContextKey contextKey = "user_id"

// JWTMiddleware extracts the JWT token, validates it, and injects user_id into context
func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error": "Unauthorized: Missing token"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error": "Unauthorized: Invalid header format"}`, http.StatusUnauthorized)
			return
		}

		// TODO: Validate your JWT token signature here
		// claims, err := validateToken(parts[1])

		// For context demonstration, assume extracted User UUID from token:
		userID := "f47ac10b-58cc-4372-a567-0e02b2c3d479"

		ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// CasbinMiddleware verifies access using user_id from context, path (obj), and method (act)
func CasbinMiddleware(e *casbin.Enforcer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(UserIDContextKey).(string)
			if !ok || userID == "" {
				http.Error(w, `{"error": "Unauthorized: User not identified"}`, http.StatusUnauthorized)
				return
			}

			path := r.URL.Path
			method := r.Method

			// Enforce against casbin_rule table loaded in memory
			allowed, err := e.Enforce(userID, path, method)
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
