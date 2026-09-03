package order

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/asifulhaque087/loot-board/services/api/internal/mail/templates"
	auth "github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
	"github.com/asifulhaque087/loot-board/services/api/internal/util"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

type Handler struct {
	svc      OrderService
	validate *validator.Validate
}

func NewHandler(svc OrderService) *Handler {
	return &Handler{
		svc:      svc,
		validate: validator.New(),
	}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var body CreateOrderRequestDto

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.svc.Create(r.Context(), body)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusCreated, result)
}

func (h *Handler) FindAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, auth.ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	result, err := h.svc.FindAll(r.Context(), claims.ID, claims.PrimaryUserID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Invoice(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing order id", http.StatusBadRequest)
		return
	}

	view, err := h.svc.Invoice(r.Context(), id)
	if err != nil {
		h.respondError(w, err)
		return
	}

	filename := "invoice-" + id + ".html"
	if len(id) > 8 {
		filename = "invoice-" + id[:8] + ".html"
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filename+"\"")
	w.WriteHeader(http.StatusOK)

	component := templates.OrderInvoiceEmail(view.Order, view.Items)
	if err := component.Render(r.Context(), w); err != nil {
		http.Error(w, ErrInternalServer.Error(), http.StatusInternalServerError)
	}
}

func (h *Handler) respondError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError

	switch {
	case errors.Is(err, ErrInvalidOrderID), errors.Is(err, ErrInvalidBoardID), errors.Is(err, ErrInvalidWidgetID),
		errors.Is(err, ErrItemsUnavailable), errors.Is(err, ErrReservationExpired):
		status = http.StatusBadRequest
	case errors.Is(err, ErrOrderNotFound), errors.Is(err, ErrBoardNotFound):
		status = http.StatusNotFound
	case errors.Is(err, ErrInternalServer):
		err = ErrInternalServer
	}

	http.Error(w, err.Error(), status)
}
