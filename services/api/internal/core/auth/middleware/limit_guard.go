package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type LimitGuardQueries interface {
	CountUserSubscriptions(ctx context.Context, userID pgtype.UUID) (int32, error)
	GetActiveSubscriptions(ctx context.Context, userID pgtype.UUID) ([]pgtype.UUID, error)
	GetPackagePermissionLimitByEndpoint(ctx context.Context, arg sqlc.GetPackagePermissionLimitByEndpointParams) (sqlc.GetPackagePermissionLimitByEndpointRow, error)
	IncrementLimitUsage(ctx context.Context, arg sqlc.IncrementLimitUsageParams) (pgtype.UUID, error)
	DecrementLimitUsage(ctx context.Context, arg sqlc.DecrementLimitUsageParams) (pgtype.UUID, error)
	GetLimitUsage(ctx context.Context, arg sqlc.GetLimitUsageParams) (int32, error)
	InitializeLimitUsage(ctx context.Context, arg sqlc.InitializeLimitUsageParams) (pgtype.UUID, error)
}

type LimitGuard struct {
	queries LimitGuardQueries
	logger  *slog.Logger
}

func NewLimitGuard(queries LimitGuardQueries, logger *slog.Logger) *LimitGuard {
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

			user, ok := auth.GetUserFromContext(r.Context())
			if !ok || user.ID == "" {
				lg.logger.Warn("limit guard rejected request",
					slog.String("pattern", pattern),
					slog.String("method", method),
					slog.String("reason", "user context missing"),
				)
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
		if err := lg.adjustUsage(ctx, tenantUUID, pkgID, pattern, method); err != nil {
			return err
		}
	}

	return nil
}

func (lg *LimitGuard) adjustUsage(ctx context.Context, tenantID, pkgID pgtype.UUID, pattern, method string) error {
	// Always look up the limit by the POST (create) permission for this endpoint.
	// The same counter is shared across POST (increment) and DELETE (decrement).
	limitRow, err := lg.queries.GetPackagePermissionLimitByEndpoint(ctx, sqlc.GetPackagePermissionLimitByEndpointParams{
		PackageID: pkgID,
		Endpoint:  pattern,
		Method:    http.MethodPost,
	})
	if err != nil {
		lg.logger.Error("failed to get package permission limit",
			slog.String("tenant_id", tenantID.String()),
			slog.String("pattern", pattern),
			slog.String("method", http.MethodPost),
			slog.String("error", err.Error()),
		)
		return nil
	}

	// Unlimited access
	if !limitRow.LimitCount.Valid || limitRow.LimitCount.Int32 == -1 {
		return nil
	}

	if method == http.MethodDelete {
		_, err := lg.queries.DecrementLimitUsage(ctx, sqlc.DecrementLimitUsageParams{
			UserID:                   tenantID,
			PackagePermissionLimitID: limitRow.ID,
		})
		if err != nil && strings.Contains(err.Error(), "no rows") {
			lg.logger.Debug("skipped limit decrement: no usage row initialized",
				slog.String("tenant_id", tenantID.String()),
				slog.String("pattern", pattern),
				slog.String("method", method),
			)
			return nil
		}
		if err != nil {
			lg.logger.Error("failed to decrement limit usage",
				slog.String("tenant_id", tenantID.String()),
				slog.String("pattern", pattern),
				slog.String("method", method),
				slog.String("error", err.Error()),
			)
		}
		return err
	}

	// POST — atomic conditional increment
	updatedID, err := lg.queries.IncrementLimitUsage(ctx, sqlc.IncrementLimitUsageParams{
		UserID:                   tenantID,
		PackagePermissionLimitID: limitRow.ID,
		Used:                     limitRow.LimitCount.Int32,
	})
	if err == nil && updatedID.Valid {
		return nil
	}

	// Check why update failed
	existing, err := lg.queries.GetLimitUsage(ctx, sqlc.GetLimitUsageParams{
		UserID:                   tenantID,
		PackagePermissionLimitID: limitRow.ID,
	})
	if err == nil && existing > 0 {
		return errLimitReached
	}

	// Initialize counter
	_, err = lg.queries.InitializeLimitUsage(ctx, sqlc.InitializeLimitUsageParams{
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
