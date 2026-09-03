package subscription

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth"
	"github.com/asifulhaque087/loot-board/services/api/internal/util"
	"github.com/go-playground/validator/v10"
)

type Handler struct {
	svc      SubscriptionService
	validate *validator.Validate
}

func NewHandler(svc SubscriptionService) *Handler {
	return &Handler{
		svc:      svc,
		validate: validator.New(),
	}
}

func (h *Handler) FindAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrInvalidUserID.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.FindAll(r.Context(), claims.ID)
	if err != nil {
		h.respondError(w, err)
		return
	}
	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var body CreateSubscriptionDto
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}
	if err := h.validate.Struct(body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrInvalidUserID.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.Subscribe(r.Context(), body, claims.ID)
	if err != nil {
		h.respondError(w, err)
		return
	}
	util.WriteJson(w, http.StatusCreated, result)
}

func (h *Handler) respondError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError

	switch {
	case errors.Is(err, ErrInvalidUserID):
		status = http.StatusBadRequest
	case errors.Is(err, ErrPackageNotFound):
		status = http.StatusNotFound
	case errors.Is(err, ErrAlreadySubscribedFree):
		status = http.StatusBadRequest
	case errors.Is(err, ErrInternalServer):
		status = http.StatusInternalServerError
	}

	http.Error(w, err.Error(), status)
}
