package realtime

import (
	"context"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SocketAuthService mints and verifies the short-lived WS exchange token used to
// authenticate tenant editors over the websocket handshake, and decides whether a
// user may reposition widgets on the canvas.
type SocketAuthService struct {
	repo     RealtimeRepo
	secret   string
}

func NewSocketAuthService(repo RealtimeRepo, wsTokenSecret string) *SocketAuthService {
	return &SocketAuthService{repo: repo, secret: wsTokenSecret}
}

type wsClaims struct {
	ID      string `json:"id"`
	BoardID string `json:"boardId"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

func (a *SocketAuthService) CreateWsToken(userID, boardID string) (string, error) {
	claims := wsClaims{
		ID:      userID,
		BoardID: boardID,
		Purpose: "ws-auth",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(a.secret))
}

// VerifyWsToken validates the handshake token and returns the embedded identity.
func (a *SocketAuthService) VerifyWsToken(token string) (userID, boardID string, ok bool) {
	parsed, err := jwt.ParseWithClaims(token, &wsClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, isHMAC := t.Method.(*jwt.SigningMethodHMAC); !isHMAC {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(a.secret), nil
	})
	if err != nil {
		return "", "", false
	}
	claims, ok := parsed.Claims.(*wsClaims)
	if !ok || !parsed.Valid || claims.Purpose != "ws-auth" {
		return "", "", false
	}
	return claims.ID, claims.BoardID, true
}

// Authenticate returns the user id from the ws token, or "" if absent/invalid.
func (a *SocketAuthService) Authenticate(token string) string {
	id, _, ok := a.VerifyWsToken(token)
	if !ok {
		return ""
	}
	return id
}

func (a *SocketAuthService) CanManageWidgets(ctx context.Context, userID string) (bool, error) {
	uid, err := parseUUID(userID)
	if err != nil {
		return false, nil
	}
	grants, err := a.repo.GetUserWidgetPermissions(ctx, uid)
	if err != nil {
		return false, ErrInternalServer
	}
	for _, g := range grants {
		if g.Action == "update" && g.Subject == "SmartWidget" {
			return true, nil
		}
	}
	return false, nil
}
