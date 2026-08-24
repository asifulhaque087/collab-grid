package mock

import (
	"context"
	"crypto/rand"
	"database/sql"
	"sync"

	"github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/jackc/pgx/v5/pgtype"
)

type FakeRepo struct {
	mu            sync.RWMutex
	users         []auth.User
	packages      map[string]auth.Package
	roles         map[string]auth.Role
	subscriptions []auth.CreateSubscriptionParams
	userRoles     []auth.AssignUserRoleParams
}

func NewFakeRepo() *FakeRepo {
	fr := &FakeRepo{
		users:         make([]auth.User, 0),
		packages:      make(map[string]auth.Package),
		roles:         make(map[string]auth.Role),
		subscriptions: make([]auth.CreateSubscriptionParams, 0),
		userRoles:     make([]auth.AssignUserRoleParams, 0),
	}

	// Seed default package & role expected during signup
	var packageUUID, roleUUID pgtype.UUID
	_ = packageUUID.Scan("00000000-0000-0000-0000-000000000001")
	_ = roleUUID.Scan("00000000-0000-0000-0000-000000000002")

	fr.packages["free"] = auth.Package{
		ID:    packageUUID,
		Title: "Free Plan",
		Slug:  "free",
	}

	fr.roles["tenant"] = auth.Role{
		ID:    roleUUID,
		Title: "Tenant",
		Slug:  "tenant",
	}

	return fr
}

// ============================================================================
// Service Methods Implementation
// ============================================================================

func (f *FakeRepo) GetUserByEmail(ctx context.Context, email string) (auth.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.Email == email {
			return u, nil
		}
	}
	return auth.User{}, sql.ErrNoRows
}

func (f *FakeRepo) GetUserById(ctx context.Context, id pgtype.UUID) (auth.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.ID.Bytes == id.Bytes && u.ID.Valid == id.Valid {
			return u, nil
		}
	}
	return auth.User{}, sql.ErrNoRows
}

func (f *FakeRepo) GetPackageBySlug(ctx context.Context, slug string) (auth.Package, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	pkg, exists := f.packages[slug]
	if !exists {
		return auth.Package{}, sql.ErrNoRows
	}
	return pkg, nil
}

func (f *FakeRepo) GetRoleBySlug(ctx context.Context, slug string) (auth.Role, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	role, exists := f.roles[slug]
	if !exists {
		return auth.Role{}, sql.ErrNoRows
	}
	return role, nil
}

func (f *FakeRepo) CreateUser(ctx context.Context, arg auth.CreateUserParams) (auth.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	user := auth.User{
		ID:       newUUID(),
		Name:     arg.Name,
		Email:    arg.Email,
		Password: pgtype.Text{String: arg.Password, Valid: arg.Password != ""},
		Provider: pgtype.Text{String: arg.Provider, Valid: arg.Provider != ""},
	}

	f.users = append(f.users, user)
	return user, nil
}

func (f *FakeRepo) AssignUserRole(ctx context.Context, arg auth.AssignUserRoleParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.userRoles = append(f.userRoles, arg)
	return nil
}

func (f *FakeRepo) CreateSubscription(ctx context.Context, arg auth.CreateSubscriptionParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.subscriptions = append(f.subscriptions, arg)
	return nil
}

func (f *FakeRepo) UpdateRefreshToken(ctx context.Context, arg auth.UpdateRefreshTokenParams) error {
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

func (f *FakeRepo) GetUserByRefreshToken(ctx context.Context, refreshToken pgtype.Text) (auth.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	if !refreshToken.Valid {
		return auth.User{}, sql.ErrNoRows
	}

	for _, u := range f.users {
		if u.RefreshToken.Valid && u.RefreshToken.String == refreshToken.String {
			return u, nil
		}
	}
	return auth.User{}, sql.ErrNoRows
}

func (f *FakeRepo) GetAccessContextByUserId(ctx context.Context, userID pgtype.UUID) ([]auth.GetAccessContextByUserIdRow, error) {
	return nil, nil
}

func (f *FakeRepo) GetUserByResetToken(ctx context.Context, resetPasswordToken pgtype.Text) (auth.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.ResetPasswordToken.Valid && u.ResetPasswordToken.String == resetPasswordToken.String {
			return u, nil
		}
	}
	return auth.User{}, sql.ErrNoRows
}

func (f *FakeRepo) GetUserQuotas(ctx context.Context, userID pgtype.UUID) ([]auth.GetUserQuotasRow, error) {
	return nil, nil
}

func (f *FakeRepo) SetResetPasswordToken(ctx context.Context, arg auth.SetResetPasswordTokenParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, u := range f.users {
		if u.ID.Bytes == arg.ID.Bytes && u.ID.Valid == arg.ID.Valid {
			f.users[i].ResetPasswordToken = arg.ResetPasswordToken
			f.users[i].ResetPasswordExpiresAt = arg.ResetPasswordExpiresAt
			return nil
		}
	}
	return sql.ErrNoRows
}

func (f *FakeRepo) UpdatePasswordAndClearTokens(ctx context.Context, arg auth.UpdatePasswordAndClearTokensParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, u := range f.users {
		if u.ID.Bytes == arg.ID.Bytes && u.ID.Valid == arg.ID.Valid {
			f.users[i].Password = arg.Password
			f.users[i].RefreshToken = pgtype.Text{Valid: false}
			f.users[i].ResetPasswordToken = pgtype.Text{Valid: false}
			f.users[i].ResetPasswordExpiresAt = pgtype.Timestamp{Valid: false}
			return nil
		}
	}
	return sql.ErrNoRows
}

// ============================================================================
// Helper & Reset Methods for Testing
// ============================================================================

func (f *FakeRepo) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.users = make([]auth.User, 0)
	f.subscriptions = make([]auth.CreateSubscriptionParams, 0)
	f.userRoles = make([]auth.AssignUserRoleParams, 0)
}

func (f *FakeRepo) AddPackage(pkg auth.Package) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.packages[pkg.Slug] = pkg
}

func (f *FakeRepo) AddRole(role auth.Role) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.roles[role.Slug] = role
}

func newUUID() pgtype.UUID {
	var buf [16]byte
	_, _ = rand.Read(buf[:])
	return pgtype.UUID{Bytes: buf, Valid: true}
}
