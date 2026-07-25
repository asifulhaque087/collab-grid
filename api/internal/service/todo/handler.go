package todo

import (
	"encoding/json"
	"net/http"

	"github.com/asifulhaque087/todo-go-lang/internal/util"
)

type Handler struct {
	todoService UserService
}

func NewHandler(todoService UserService) *Handler {
	return &Handler{todoService: todoService}
}

func (h *Handler) CreateTodo(w http.ResponseWriter, r *http.Request) {

	var body CreateTodoBody

	err := json.NewDecoder(r.Body).Decode(&body)

	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	todo, err := h.todoService.Create(ctx, body.Title)

	if err != nil {
		// http.Error(w, "failed to create todo", http.StatusBadRequest)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	util.WriteJson(w, http.StatusCreated, todo)

}

func (h *Handler) GetTodos(w http.ResponseWriter, r *http.Request) {

	ctx := r.Context()

	// it will depend on service
	todos, err := h.todoService.FindAll(ctx)

	if err != nil {
		http.Error(w, "failed to get todos", http.StatusBadRequest)
		return
	}

	util.WriteJson(w, http.StatusAccepted, todos)

}

func (h *Handler) GetTodo(w http.ResponseWriter, r *http.Request) {

	todoId := r.PathValue("id")

	ctx := r.Context()

	// it will depend on service
	todo, err := h.todoService.FindById(ctx, todoId)

	if err != nil {
		// http.Error(w, "failed to create todo", http.StatusBadRequest)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	util.WriteJson(w, http.StatusCreated, todo)
}
