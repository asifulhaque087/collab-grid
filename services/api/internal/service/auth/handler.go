package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/asifulhaque087/collab-grid/services/api/internal/util"
)

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

func (h *Handler) HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	url := h.svc.GoogleLogin(r.Context())
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *Handler) HandleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if state != "random_csrf_state_token" {
		http.Error(w, "Invalid state", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing authorization code", http.StatusBadRequest)
		return
	}

	result, err := h.svc.GoogleCallback(r.Context(), code)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}
