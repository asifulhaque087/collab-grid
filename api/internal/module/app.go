package module

import (
	"net/http"

	"github.com/asifulhaque087/todo-go-lang/internal/db"
	"github.com/asifulhaque087/todo-go-lang/internal/service/todo"
)

type App struct{}

func NewApp() *App {
	return &App{}
}

func (t *App) RegisterRoute(mux *http.ServeMux) {

	dbClient := db.Connect()

	// create repos
	todoRepo := todo.NewRepo(dbClient)

	// create services
	todoService := todo.NewService(todoRepo)

	// create handlers
	todoHandler := todo.NewHandler(todoService)

	// create router
	mux.HandleFunc("GET /todos", todoHandler.GetTodos)
	mux.HandleFunc("POST /todos", todoHandler.CreateTodo)
	mux.HandleFunc("GET /todos/{id}", todoHandler.GetTodo)
}
