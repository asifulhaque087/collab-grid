package boards

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
	svc      BoardService
	validate *validator.Validate
}

func NewHandler(svc BoardService) *Handler {
	return &Handler{
		svc:      svc,
		validate: validator.New(),
	}
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

func (h *Handler) FindBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		http.Error(w, "missing board slug", http.StatusBadRequest)
		return
	}

	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.FindBySlug(r.Context(), slug, claims.ID, claims.PrimaryUserID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var body CreateBoardRequestDto

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
		http.Error(w, "missing board id", http.StatusBadRequest)
		return
	}

	var body UpdateBoardRequestDto

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

	result, err := h.svc.Update(r.Context(), id, body, claims.ID, claims.PrimaryUserID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing board id", http.StatusBadRequest)
		return
	}

	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	err := h.svc.Remove(r.Context(), id, claims.ID, claims.PrimaryUserID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// FindPublicBySlug serves publicly shared boards; it does not require authentication.
func (h *Handler) FindPublicBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		http.Error(w, "missing board slug", http.StatusBadRequest)
		return
	}

	result, err := h.svc.FindPublicBySlug(r.Context(), slug)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) respondError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError

	switch {
	case errors.Is(err, ErrInvalidBoardID):
		status = http.StatusBadRequest
	case errors.Is(err, ErrUnauthorized):
		status = http.StatusUnauthorized
	case errors.Is(err, ErrBoardNotFound):
		status = http.StatusNotFound
	case errors.Is(err, ErrInternalServer):
		err = ErrInternalServer
	}

	http.Error(w, err.Error(), status)
}
