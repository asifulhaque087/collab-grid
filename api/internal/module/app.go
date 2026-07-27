package module

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/asifulhaque087/todo-go-lang/internal/adapters/postgresql"
	repo "github.com/asifulhaque087/todo-go-lang/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/todo-go-lang/internal/service/todo"
)

type App struct{}

func NewApp() *App {
	return &App{}
}

func (t *App) RegisterRoute(mux *http.ServeMux) {

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Passes root ctx down to connection setup
	pool, err := postgresql.NewPool(ctx)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close()

	queries := repo.New(pool)

	// create services
	todoService := todo.NewService(queries)

	// create handlers
	todoHandler := todo.NewHandler(todoService)

	// create router
	mux.HandleFunc("GET /todos", todoHandler.GetTodos)
	mux.HandleFunc("POST /todos", todoHandler.CreateTodo)
	mux.HandleFunc("GET /todos/{id}", todoHandler.GetTodo)
}
