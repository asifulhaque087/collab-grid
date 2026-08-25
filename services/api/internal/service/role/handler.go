package role

import (
	"encoding/json"
	"errors"
	"net/http"

	auth "github.com/asifulhaque087/collab-grid/services/api/internal/service/auth"
	"github.com/asifulhaque087/collab-grid/services/api/internal/util"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

type Handler struct {
	svc      RoleService
	validate *validator.Validate
}

func NewHandler(svc RoleService) *Handler {
	return &Handler{
		svc:      svc,
		validate: validator.New(),
	}
}

// ListPermissions serves the permission catalog used to build roles.
func (h *Handler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.ListPermissions(r.Context(), claims.ID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) FindAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.FindAll(r.Context(), claims.ID, claims.PrimaryUserID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var body CreateRoleRequestDto

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.Create(r.Context(), body, claims.ID, claims.PrimaryUserID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusCreated, result)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing role id", http.StatusBadRequest)
		return
	}

	var body UpdateRoleRequestDto

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.svc.Update(r.Context(), id, body)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing role id", http.StatusBadRequest)
		return
	}

	err := h.svc.Remove(r.Context(), id)
	if err != nil {
		h.respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) respondError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError

	switch {
	case errors.Is(err, ErrInvalidRoleID), errors.Is(err, ErrInvalidPermission):
		status = http.StatusBadRequest
	case errors.Is(err, ErrUnauthorized):
		status = http.StatusUnauthorized
	case errors.Is(err, ErrRoleNotFound):
		status = http.StatusNotFound
	case errors.Is(err, ErrInternalServer):
		err = ErrInternalServer
	}

	http.Error(w, err.Error(), status)
}
