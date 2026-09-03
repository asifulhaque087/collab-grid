package realtime

import (
	"encoding/json"
	"net/http"

	auth "github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
	"github.com/go-chi/chi/v5"
)

// TokenExchangeHandler issues a short-lived WS exchange token. A tenant editor
// presents this token in the websocket handshake (query param `token=`) so the
// gateway can authenticate the socket without re-sending the access token.
type TokenExchangeHandler struct {
	socketAuth *SocketAuthService
}

func NewTokenExchangeHandler(socketAuth *SocketAuthService) *TokenExchangeHandler {
	return &TokenExchangeHandler{socketAuth: socketAuth}
}

type exchangeRequest struct {
	BoardID string `json:"boardId"`
}

func (h *TokenExchangeHandler) Exchange(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var body exchangeRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}

	token, err := h.socketAuth.CreateWsToken(claims.ID, body.BoardID)
	if err != nil {
		http.Error(w, `{"error":"failed to create token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// MountRoutes registers the realtime HTTP surface (token-exchange + websocket).
func (h *TokenExchangeHandler) MountRoutes(r chi.Router, gateway *RealtimeGateway) {
	r.Post("/token-exchange", h.Exchange)
	r.Get("/canvas", gateway.ServeWS)
}
