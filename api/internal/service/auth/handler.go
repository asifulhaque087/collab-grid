package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/asifulhaque087/collab-grid/api/internal/util"
)

type AuthService interface {
	RegisterUser(ctx context.Context, dto RegisterUserDto) (*RegisterResponse, error)
}

type Handler struct {
	svc AuthService
}

func NewHandler(svc AuthService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body RegisterUserDto

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	result, err := h.svc.RegisterUser(ctx, body)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, ErrEmailConflict) {
			status = http.StatusConflict
		}
		http.Error(w, err.Error(), status)
		return
	}

	util.WriteJson(w, http.StatusCreated, result)
}
