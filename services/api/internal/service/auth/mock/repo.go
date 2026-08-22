package mock

import (
	"context"
	"crypto/rand"
	"database/sql"
	"sync"

	repo "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

type FakeRepo struct {
	mu            sync.RWMutex
	users         []repo.User
	packages      map[string]repo.Package
	roles         map[string]repo.Role
	subscriptions []repo.CreateSubscriptionParams
	userRoles     []repo.AssignUserRoleParams
	repo.Querier
}

func NewFakeRepo() *FakeRepo {
	fr := &FakeRepo{
		users:         make([]repo.User, 0),
		packages:      make(map[string]repo.Package),
		roles:         make(map[string]repo.Role),
		subscriptions: make([]repo.CreateSubscriptionParams, 0),
		userRoles:     make([]repo.AssignUserRoleParams, 0),
	}

	// Seed default package & role expected during signup
	var packageUUID, roleUUID pgtype.UUID
	_ = packageUUID.Scan("00000000-0000-0000-0000-000000000001")
	_ = roleUUID.Scan("00000000-0000-0000-0000-000000000002")

	fr.packages["free"] = repo.Package{
		ID:    packageUUID,
		Title: "Free Plan",
		Slug:  "free",
	}

	fr.roles["tenant"] = repo.Role{
		ID:    roleUUID,
		Title: "Tenant",
		Slug:  "tenant",
	}

	return fr
}

// ============================================================================
// Service Methods Implementation
// ============================================================================

func (f *FakeRepo) GetUserByEmail(ctx context.Context, email string) (repo.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.Email == email {
			return u, nil
		}
	}
	return repo.User{}, sql.ErrNoRows
}

func (f *FakeRepo) GetUserById(ctx context.Context, id pgtype.UUID) (repo.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.ID.Bytes == id.Bytes && u.ID.Valid == id.Valid {
			return u, nil
		}
	}
	return repo.User{}, sql.ErrNoRows
}

func (f *FakeRepo) GetPackageBySlug(ctx context.Context, slug string) (repo.Package, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	pkg, exists := f.packages[slug]
	if !exists {
		return repo.Package{}, sql.ErrNoRows
	}
	return pkg, nil
}

func (f *FakeRepo) GetRoleBySlug(ctx context.Context, slug string) (repo.Role, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	role, exists := f.roles[slug]
	if !exists {
		return repo.Role{}, sql.ErrNoRows
	}
	return role, nil
}

func (f *FakeRepo) CreateUser(ctx context.Context, arg repo.CreateUserParams) (repo.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	user := repo.User{
		ID:       newUUID(),
		Name:     arg.Name,
		Email:    arg.Email,
		Password: arg.Password,
		Provider: arg.Provider,
	}

	f.users = append(f.users, user)
	return user, nil
}

func (f *FakeRepo) AssignUserRole(ctx context.Context, arg repo.AssignUserRoleParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.userRoles = append(f.userRoles, arg)
	return nil
}

func (f *FakeRepo) CreateSubscription(ctx context.Context, arg repo.CreateSubscriptionParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.subscriptions = append(f.subscriptions, arg)
	return nil
}

func (f *FakeRepo) UpdateRefreshToken(ctx context.Context, arg repo.UpdateRefreshTokenParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, u := range f.users {
		if u.ID.Bytes == arg.ID.Bytes && u.ID.Valid == arg.ID.Valid {
			f.users[i].RefreshToken = arg.RefreshToken
			return nil
		}
	}
	return sql.ErrNoRows
}

func (f *FakeRepo) ClearRefreshToken(ctx context.Context, id pgtype.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, u := range f.users {
		if u.ID.Bytes == id.Bytes && u.ID.Valid == id.Valid {
			f.users[i].RefreshToken = pgtype.Text{Valid: false}
			return nil
		}
	}
	return nil
}

func (f *FakeRepo) GetUserByRefreshToken(ctx context.Context, refreshToken pgtype.Text) (repo.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	if !refreshToken.Valid {
		return repo.User{}, sql.ErrNoRows
	}

	for _, u := range f.users {
		if u.RefreshToken.Valid && u.RefreshToken.String == refreshToken.String {
			return u, nil
		}
	}
	return repo.User{}, sql.ErrNoRows
}

// ExecTx executes the provided transaction callback using the FakeRepo receiver
func (f *FakeRepo) ExecTx(ctx context.Context, fn func(*repo.Queries) error) error {
	return fn(nil)
}

// ============================================================================
// Helper & Reset Methods for Testing
// ============================================================================

func (f *FakeRepo) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.users = make([]repo.User, 0)
	f.subscriptions = make([]repo.CreateSubscriptionParams, 0)
	f.userRoles = make([]repo.AssignUserRoleParams, 0)
}

func (f *FakeRepo) AddPackage(pkg repo.Package) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.packages[pkg.Slug] = pkg
}

func (f *FakeRepo) AddRole(role repo.Role) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.roles[role.Slug] = role
}

func newUUID() pgtype.UUID {
	var buf [16]byte
	_, _ = rand.Read(buf[:])
	return pgtype.UUID{Bytes: buf, Valid: true}
}
