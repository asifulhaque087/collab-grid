package auth

import (
	"encoding/json"
	"net/http"

	"github.com/asifulhaque087/collab-grid/api/internal/util"
)

type Handler struct {
	svc AuthService
}

func NewHandler(svc AuthService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {

	var body CreateUserBody

	err := json.NewDecoder(r.Body).Decode(&body)

	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	user, err := h.svc.Create(ctx, body.Title)

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	util.WriteJson(w, http.StatusCreated, user)

}

// func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {

// 	ctx := r.Context()

// 	users, err := h.svc.FindAll(ctx)

// 	if err != nil {
// 		http.Error(w, "failed to get users", http.StatusBadRequest)
// 		return
// 	}

// 	util.WriteJson(w, http.StatusAccepted, users)

// }

// func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {

// 	userId := r.PathValue("id")

// 	ctx := r.Context()

// 	user, err := h.svc.FindById(ctx, userId)

// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	util.WriteJson(w, http.StatusCreated, user)
// }

// func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {

// 	userId := r.PathValue("id")

// 	ctx := r.Context()

// 	user, err := h.svc.FindById(ctx, userId)

// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	util.WriteJson(w, http.StatusCreated, user)
// }

// func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {

// }

// func (h *Handler) Logout(w http.ResponseWriter, r *http.Request)  {}
// func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {}
