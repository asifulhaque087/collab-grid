package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"sync"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

func newFakeUUID() pgtype.UUID {
	var buf [16]byte
	_, _ = rand.Read(buf[:])
	return pgtype.UUID{Bytes: buf, Valid: true}
}

type fakePermissionLimit struct {
	ID        pgtype.UUID
	PackageID pgtype.UUID
	Endpoint  string
	Method    string
	Limit     int32
}

type fakeSubscription struct {
	UserID    pgtype.UUID
	PackageID pgtype.UUID
}

type fakeUsage struct {
	UserID                   pgtype.UUID
	PackagePermissionLimitID pgtype.UUID
	Used                     int32
}

type FakeLimitGuardQueries struct {
	mu            sync.RWMutex
	limits        []fakePermissionLimit
	subscriptions []fakeSubscription
	usages        []fakeUsage
	nextID        int
}

func NewFakeLimitGuardQueries() *FakeLimitGuardQueries {
	return &FakeLimitGuardQueries{
		limits:        make([]fakePermissionLimit, 0),
		subscriptions: make([]fakeSubscription, 0),
		usages:        make([]fakeUsage, 0),
	}
}

func (f *FakeLimitGuardQueries) AddPermissionLimit(packageID pgtype.UUID, endpoint, method string, limit int32) pgtype.UUID {
	f.mu.Lock()
	defer f.mu.Unlock()

	id := newFakeUUID()

	f.limits = append(f.limits, fakePermissionLimit{
		ID:        id,
		PackageID: packageID,
		Endpoint:  endpoint,
		Method:    method,
		Limit:     limit,
	})
	return id
}

func (f *FakeLimitGuardQueries) AddPermissionLimitStr(packageID, endpoint, method string, limit int32) pgtype.UUID {
	var pkg pgtype.UUID
	if err := pkg.Scan(packageID); err != nil {
		panic("AddPermissionLimitStr: invalid packageID: " + err.Error())
	}
	return f.AddPermissionLimit(pkg, endpoint, method, limit)
}

func (f *FakeLimitGuardQueries) AddSubscription(userID, packageID pgtype.UUID) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.subscriptions = append(f.subscriptions, fakeSubscription{
		UserID:    userID,
		PackageID: packageID,
	})
}

func (f *FakeLimitGuardQueries) AddSubscriptionStr(userID, packageID string) {
	var uid, pkg pgtype.UUID
	if err := uid.Scan(userID); err != nil {
		panic("AddSubscriptionStr: invalid userID: " + err.Error())
	}
	if err := pkg.Scan(packageID); err != nil {
		panic("AddSubscriptionStr: invalid packageID: " + err.Error())
	}
	f.AddSubscription(uid, pkg)
}

func (f *FakeLimitGuardQueries) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.limits = make([]fakePermissionLimit, 0)
	f.subscriptions = make([]fakeSubscription, 0)
	f.usages = make([]fakeUsage, 0)
}

func (f *FakeLimitGuardQueries) CountUserSubscriptions(ctx context.Context, userID pgtype.UUID) (int32, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var count int32
	for _, s := range f.subscriptions {
		if s.UserID.Bytes == userID.Bytes && s.UserID.Valid == userID.Valid {
			count++
		}
	}
	return count, nil
}

func (f *FakeLimitGuardQueries) GetActiveSubscriptions(ctx context.Context, userID pgtype.UUID) ([]pgtype.UUID, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var result []pgtype.UUID
	for _, s := range f.subscriptions {
		if s.UserID.Bytes == userID.Bytes && s.UserID.Valid == userID.Valid {
			result = append(result, s.PackageID)
		}
	}
	return result, nil
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
