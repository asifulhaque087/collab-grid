package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
)

func JWTMiddleware(authService *auth.Service, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log := logger.With(
				slog.String("path", r.URL.Path),
				slog.String("method", r.Method),
			)

			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				log.Warn("jwt authentication failed", slog.String("reason", "missing authorization header"))
				http.Error(w, `{"error": "Unauthorized: Missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				log.Warn("jwt authentication failed", slog.String("reason", "invalid authorization header format"))
				http.Error(w, `{"error": "Unauthorized: Invalid header format"}`, http.StatusUnauthorized)
				return
			}

			claims, err := authService.ValidateAccessToken(parts[1])
			if err != nil {
				log.Warn("jwt authentication failed",
					slog.String("reason", "invalid or expired token"),
					slog.String("error", err.Error()),
				)
				http.Error(w, `{"error": "Unauthorized: Invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), auth.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
