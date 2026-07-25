package todo

import (
	"context"
	"sync"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// FakeRepo implements the TodoRepo interface using an in-memory map.
type FakeRepo struct {
	// mu ensures our fake repo is thread-safe during concurrent tests
	mu    sync.RWMutex
	todos []Todo
	// Bigtodos [] Todo
}

// NewFakeRepo initializes the fake repository
func NewFakeRepo() *FakeRepo {
	return &FakeRepo{
		todos: []Todo{},
	}
}

func (f *FakeRepo) GetTodos() *[]Todo {
	return &f.todos
}

func (f *FakeRepo) Create(ctx context.Context, title string) (*Todo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	newTodo := Todo{
		// We generate a real bson.ObjectID so it behaves like the real DB
		Id:    bson.NewObjectID(),
		Title: title,
	}

	f.todos = append(f.todos, newTodo)
	return &newTodo, nil
}

func (f *FakeRepo) FindById(ctx context.Context, todoId string) (*Todo, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, t := range f.todos {
		if t.Id.Hex() == todoId {
			// In a real scenario, you'd return &t here
			return &t, nil
		}
	}
	return nil, nil
}

func (f *FakeRepo) FindAll(ctx context.Context) (*[]Todo, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	// Return a copy to avoid mutation issues in tests
	results := make([]Todo, len(f.todos))
	copy(results, f.todos)

	return &results, nil
}

// Helper method for testing to clear the state between test cases
func (f *FakeRepo) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.todos = []Todo{}
}
