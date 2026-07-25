package module

import (
	"net/http"

	"github.com/asifulhaque087/todo-go-lang/internal/service/todo"
)

type TestModule struct {
	TodoRepo *todo.FakeRepo
}

func NewTestModule() *TestModule {
	// return &TestModule{}
	return &TestModule{
		TodoRepo: todo.NewFakeRepo(),
	}
}

func (t *TestModule) RegisterRoute(mux *http.ServeMux) {

	// service
	todoService := todo.NewService(t.TodoRepo)

	// create handlers
	todoHandler := todo.NewHandler(todoService)

	// create router
	mux.HandleFunc("GET /todos", todoHandler.GetTodos)
	mux.HandleFunc("POST /todos", todoHandler.CreateTodo)
	mux.HandleFunc("GET /todos/{id}", todoHandler.GetTodo)
	// mux.HandleFunc("GET /todos", todoHandler.GetTodos)
}
