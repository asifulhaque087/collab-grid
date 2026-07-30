package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/casbin/casbin/v2"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type contextKey string

const (
	UserContextKey contextKey = "user_claims"
)

func GetUserFromContext(ctx context.Context) (*JwtPayload, bool) {
	user, ok := ctx.Value(UserContextKey).(*JwtPayload)
	return user, ok
}

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

func CasbinMiddleware(e *casbin.Enforcer) func(http.Handler) http.Handler {
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

type LimitGuard struct {
	queries *repo.Queries
	logger  *slog.Logger
}

func NewLimitGuard(queries *repo.Queries, logger *slog.Logger) *LimitGuard {
	return &LimitGuard{queries: queries, logger: logger}
}

func (lg *LimitGuard) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rctx := chi.RouteContext(r.Context())
			pattern := rctx.RoutePattern()
			if pattern == "" {
				pattern = r.URL.Path
			}

			// Only enforce limits on Create (POST) and Delete actions
			method := r.Method
			if method != http.MethodPost && method != http.MethodDelete {
				next.ServeHTTP(w, r)
				return
			}

			user, ok := GetUserFromContext(r.Context())
			if !ok || user.ID == "" {
				http.Error(w, `{"error": "Unauthorized: User context missing"}`, http.StatusUnauthorized)
				return
			}

			var tenantID string
			if user.PrimaryUserID != "" {
				tenantID = user.PrimaryUserID
			} else {
				tenantID = user.ID
			}

			if err := lg.enforceLimit(r.Context(), tenantID, pattern, method); err != nil {
				lg.logger.Error("limit enforcement failed",
					slog.String("tenant_id", tenantID),
					slog.String("pattern", pattern),
					slog.String("method", method),
					slog.String("error", err.Error()),
				)
				status := http.StatusInternalServerError
				msg := `{"error": "Internal server error"}`
				if strings.Contains(err.Error(), "reached its limit") {
					status = http.StatusForbidden
					msg = `{"error": "The workspace has reached its limit for this action."}`
				}
				http.Error(w, msg, status)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (lg *LimitGuard) enforceLimit(ctx context.Context, tenantID, pattern, method string) error {
	tenantUUID, err := parseUUID(tenantID)
	if err != nil {
		return err
	}

	// Backoffice check: if the user has no subscriptions at all, skip limits
	count, err := lg.queries.CountUserSubscriptions(ctx, tenantUUID)
	if err != nil {
		return err
	}
	if count == 0 {
		return nil
	}

	activeSubs, err := lg.queries.GetActiveSubscriptions(ctx, tenantUUID)
	if err != nil {
		return err
	}
	if len(activeSubs) == 0 {
		return nil
	}

	for _, pkgID := range activeSubs {
		if err := lg.incrementUsage(ctx, tenantUUID, pkgID, pattern, method); err != nil {
			return err
		}
	}

	return nil
}

func (lg *LimitGuard) incrementUsage(ctx context.Context, tenantID, pkgID pgtype.UUID, pattern, method string) error {
	limitRow, err := lg.queries.GetPackagePermissionLimitByEndpoint(ctx, repo.GetPackagePermissionLimitByEndpointParams{
		PackageID: pkgID,
		Endpoint:  pattern,
		Method:    method,
	})
	if err != nil {
		return nil
	}

	// Unlimited access
	if !limitRow.LimitCount.Valid || limitRow.LimitCount.Int32 == -1 {
		return nil
	}

	// Atomic conditional update
	updatedID, err := lg.queries.IncrementLimitUsage(ctx, repo.IncrementLimitUsageParams{
		UserID:                   tenantID,
		PackagePermissionLimitID: limitRow.ID,
		Used:                     limitRow.LimitCount.Int32,
	})
	if err == nil && updatedID.Valid {
		return nil
	}

	// Check why update failed
	existing, err := lg.queries.GetLimitUsage(ctx, repo.GetLimitUsageParams{
		UserID:                   tenantID,
		PackagePermissionLimitID: limitRow.ID,
	})
	if err == nil && existing > 0 {
		return errLimitReached
	}

	// Initialize counter
	_, err = lg.queries.InitializeLimitUsage(ctx, repo.InitializeLimitUsageParams{
		UserID:                   tenantID,
		PackagePermissionLimitID: limitRow.ID,
	})
	return err
}

var errLimitReached = &limitReachedError{}

type limitReachedError struct{}

func (e *limitReachedError) Error() string {
	return "The workspace has reached its limit for this action."
}

func parseUUID(s string) (pgtype.UUID, error) {
	var id pgtype.UUID
	err := id.Scan(s)
	return id, err
}
