package auth

import (
	"context"
	"sync"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type FakeRepo struct {
	mu    sync.RWMutex
	users []User
}

func NewFakeRepo() *FakeRepo {
	return &FakeRepo{
		users: []User{},
	}
}

func (f *FakeRepo) GetUsers() *[]User {
	return &f.users
}

func (f *FakeRepo) Create(ctx context.Context, title string) (*User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	newUser := User{
		Id:    bson.NewObjectID(),
		Title: title,
	}

	f.users = append(f.users, newUser)
	return &newUser, nil
}

func (f *FakeRepo) FindById(ctx context.Context, id string) (*User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, u := range f.users {
		if u.Id.Hex() == id {
			return &u, nil
		}
	}
	return nil, nil
}

func (f *FakeRepo) FindAll(ctx context.Context) (*[]User, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	results := make([]User, len(f.users))
	copy(results, f.users)

	return &results, nil
}

func (f *FakeRepo) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.users = []User{}
}
