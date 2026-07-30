package auth

import (
	"context"
	"database/sql"
	"sync"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

type fakePermissionLimit struct {
	ID       pgtype.UUID
	PackageID pgtype.UUID
	Endpoint string
	Method   string
	Limit    int32
}

type fakeUsage struct {
	UserID                   pgtype.UUID
	PackagePermissionLimitID pgtype.UUID
	Used                     int32
}

type FakeLimitGuardQueries struct {
	mu      sync.RWMutex
	limits  []fakePermissionLimit
	usages  []fakeUsage
	nextID  int
}

func NewFakeLimitGuardQueries() *FakeLimitGuardQueries {
	return &FakeLimitGuardQueries{
		limits: make([]fakePermissionLimit, 0),
		usages: make([]fakeUsage, 0),
	}
}

func (f *FakeLimitGuardQueries) AddPermissionLimit(packageID pgtype.UUID, endpoint, method string, limit int32) pgtype.UUID {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.nextID++
	var id pgtype.UUID
	_ = id.Scan(int64(f.nextID))

	f.limits = append(f.limits, fakePermissionLimit{
		ID:        id,
		PackageID: packageID,
		Endpoint:  endpoint,
		Method:    method,
		Limit:     limit,
	})
	return id
}

func (f *FakeLimitGuardQueries) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.limits = make([]fakePermissionLimit, 0)
	f.usages = make([]fakeUsage, 0)
}

func (f *FakeLimitGuardQueries) CountUserSubscriptions(ctx context.Context, userID pgtype.UUID) (int32, error) {
	return 0, nil
}

func (f *FakeLimitGuardQueries) GetActiveSubscriptions(ctx context.Context, userID pgtype.UUID) ([]pgtype.UUID, error) {
	return nil, nil
}

func (f *FakeLimitGuardQueries) GetPackagePermissionLimitByEndpoint(ctx context.Context, arg repo.GetPackagePermissionLimitByEndpointParams) (repo.GetPackagePermissionLimitByEndpointRow, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, l := range f.limits {
		if l.PackageID.Bytes == arg.PackageID.Bytes && l.Endpoint == arg.Endpoint && l.Method == arg.Method {
			return repo.GetPackagePermissionLimitByEndpointRow{
				ID:         l.ID,
				LimitCount: pgtype.Int4{Int32: l.Limit, Valid: true},
			}, nil
		}
	}
	return repo.GetPackagePermissionLimitByEndpointRow{}, sql.ErrNoRows
}

func (f *FakeLimitGuardQueries) IncrementLimitUsage(ctx context.Context, arg repo.IncrementLimitUsageParams) (pgtype.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, u := range f.usages {
		if u.UserID.Bytes == arg.UserID.Bytes && u.PackagePermissionLimitID.Bytes == arg.PackagePermissionLimitID.Bytes {
			if u.Used < arg.Used {
				f.usages[i].Used++
				return f.usages[i].PackagePermissionLimitID, nil
			}
			return pgtype.UUID{}, sql.ErrNoRows
		}
	}
	return pgtype.UUID{}, sql.ErrNoRows
}

func (f *FakeLimitGuardQueries) DecrementLimitUsage(ctx context.Context, arg repo.DecrementLimitUsageParams) (pgtype.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, u := range f.usages {
		if u.UserID.Bytes == arg.UserID.Bytes && u.PackagePermissionLimitID.Bytes == arg.PackagePermissionLimitID.Bytes {
			if f.usages[i].Used > 0 {
				f.usages[i].Used--
			}
			return f.usages[i].PackagePermissionLimitID, nil
		}
	}
	return pgtype.UUID{}, sql.ErrNoRows
}

func (f *FakeLimitGuardQueries) GetLimitUsage(ctx context.Context, arg repo.GetLimitUsageParams) (int32, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.usages {
		if u.UserID.Bytes == arg.UserID.Bytes && u.PackagePermissionLimitID.Bytes == arg.PackagePermissionLimitID.Bytes {
			return u.Used, nil
		}
	}
	return 0, sql.ErrNoRows
}

func (f *FakeLimitGuardQueries) InitializeLimitUsage(ctx context.Context, arg repo.InitializeLimitUsageParams) (pgtype.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	entry := fakeUsage{
		UserID:                   arg.UserID,
		PackagePermissionLimitID: arg.PackagePermissionLimitID,
		Used:                     1,
	}
	f.usages = append(f.usages, entry)
	return arg.PackagePermissionLimitID, nil
}
