package auth

import (
	"context"
	"crypto/rand"
	"fmt"
	"sync"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

type FakeRepo struct {
	mu    sync.RWMutex
	users []repo.User
}

func NewFakeRepo() *FakeRepo {
	return &FakeRepo{
		users: []repo.User{},
	}
}

func (f *FakeRepo) GetUsers() *[]repo.User {
	return &f.users
}

func (f *FakeRepo) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.users = []repo.User{}
}

func newUUID() pgtype.UUID {
	var buf [16]byte
	rand.Read(buf[:])
	return pgtype.UUID{Bytes: buf, Valid: true}
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

func (f *FakeRepo) GetUserByEmail(ctx context.Context, email string) (repo.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.Email == email {
			return u, nil
		}
	}
	return repo.User{}, fmt.Errorf("user not found")
}

func (f *FakeRepo) GetUserById(ctx context.Context, id pgtype.UUID) (repo.User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.ID.Bytes == id.Bytes && u.ID.Valid == id.Valid {
			return u, nil
		}
	}
	return repo.User{}, fmt.Errorf("user not found")
}

func (f *FakeRepo) GetPackageBySlug(ctx context.Context, slug string) (repo.Package, error) {
	var uuid pgtype.UUID
	uuid.Scan("00000000-0000-0000-0000-000000000001")

	return repo.Package{
		ID:    uuid,
		Title: "Free",
		Slug:  "free",
	}, nil
}

func (f *FakeRepo) GetRoleBySlug(ctx context.Context, slug string) (repo.Role, error) {
	var uuid pgtype.UUID
	uuid.Scan("00000000-0000-0000-0000-000000000002")

	return repo.Role{
		ID:    uuid,
		Title: "Member",
		Slug:  "member",
	}, nil
}

func (f *FakeRepo) AssignUserRole(ctx context.Context, arg repo.AssignUserRoleParams) error {
	return nil
}

func (f *FakeRepo) CreateSubscription(ctx context.Context, arg repo.CreateSubscriptionParams) error {
	return nil
}

func (f *FakeRepo) ClearRefreshToken(ctx context.Context, id pgtype.UUID) error {
	return nil
}

func (f *FakeRepo) GetAccessContextByUserId(ctx context.Context, userID pgtype.UUID) ([]repo.GetAccessContextByUserIdRow, error) {
	return nil, nil
}

func (f *FakeRepo) GetUserByRefreshToken(ctx context.Context, refreshToken pgtype.Text) (repo.User, error) {
	return repo.User{}, fmt.Errorf("not implemented")
}

func (f *FakeRepo) GetUserByResetToken(ctx context.Context, resetPasswordToken pgtype.Text) (repo.User, error) {
	return repo.User{}, fmt.Errorf("not implemented")
}

func (f *FakeRepo) GetUserQuotas(ctx context.Context, userID pgtype.UUID) ([]repo.GetUserQuotasRow, error) {
	return nil, nil
}

func (f *FakeRepo) SetResetPasswordToken(ctx context.Context, arg repo.SetResetPasswordTokenParams) error {
	return nil
}

func (f *FakeRepo) UpdatePasswordAndClearTokens(ctx context.Context, arg repo.UpdatePasswordAndClearTokensParams) error {
	return nil
}

func (f *FakeRepo) UpdateRefreshToken(ctx context.Context, arg repo.UpdateRefreshTokenParams) error {
	return nil
}
