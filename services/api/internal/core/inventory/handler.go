package inventory

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	auth "github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
	"github.com/asifulhaque087/loot-board/services/api/internal/util"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

type Handler struct {
	svc      InventoryService
	validate *validator.Validate
}

func NewHandler(svc InventoryService) *Handler {
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

	var boardID *string
	if boardId := r.URL.Query().Get("boardId"); boardId != "" {
		boardID = &boardId
	}

	result, err := h.svc.FindAll(r.Context(), claims.ID, claims.PrimaryUserID, boardID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusOK, result)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var body CreateInventoryRequestDto

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	normalizePrice(&body.Price)

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

// ImportCsv accepts a multipart upload with a `file` CSV part and an optional
// `boardId` form field.
func (h *Handler) ImportCsv(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxCSVUploadSize)

	if err := r.ParseMultipartForm(maxCSVUploadSize); err != nil {
		http.Error(w, csvRequiredMessage, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil || file == nil {
		http.Error(w, csvRequiredMessage, http.StatusBadRequest)
		return
	}
	defer file.Close()

	content, err := io.ReadAll(io.LimitReader(file, maxCSVUploadSize))
	if err != nil {
		http.Error(w, csvRequiredMessage, http.StatusBadRequest)
		return
	}

	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	var boardID *string
	if boardId := r.FormValue("boardId"); boardId != "" {
		boardID = &boardId
	}

	result, err := h.svc.ImportCsv(r.Context(), content, claims.ID, claims.PrimaryUserID, boardID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	util.WriteJson(w, http.StatusCreated, result)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing inventory item id", http.StatusBadRequest)
		return
	}

	var body UpdateInventoryRequestDto

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "failed to parse JSON data", http.StatusBadRequest)
		return
	}

	normalizePrice(&body.Price)

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
		http.Error(w, "missing inventory item id", http.StatusBadRequest)
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

func normalizePrice(price **string) {
	if *price != nil && **price == "" {
		*price = nil
	}
}

func (h *Handler) respondError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError

	switch {
	case errors.Is(err, ErrInvalidItemID),
		errors.Is(err, ErrInvalidBoardID),
		errors.Is(err, ErrInvalidPrice),
		errors.Is(err, ErrInvalidCsvFile):
		status = http.StatusBadRequest
	case errors.Is(err, ErrUnauthorized):
		status = http.StatusUnauthorized
	case errors.Is(err, ErrItemNotFound), errors.Is(err, ErrBoardNotFound):
		status = http.StatusNotFound
	case errors.Is(err, ErrInternalServer):
		err = ErrInternalServer
	}

	http.Error(w, err.Error(), status)
}
