package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
)

type contextKey string

const (
	UserContextKey contextKey = "user_claims"
)

func GetUserFromContext(ctx context.Context) (*auth.JwtPayload, bool) {
	user, ok := ctx.Value(UserContextKey).(*auth.JwtPayload)
	return user, ok
}

func JWTMiddleware(authService *auth.Service) func(http.Handler) http.Handler {
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

			claims, err := authService.ValidateAccessToken(parts[1])
			if err != nil {
				http.Error(w, `{"error": "Unauthorized: Invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
