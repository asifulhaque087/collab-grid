package realtime

import "encoding/json"

// Viewport is a rectangular region of the 10k x 10k world space.
type Viewport struct {
	MinX float64 `json:"minX"`
	MinY float64 `json:"minY"`
	MaxX float64 `json:"maxX"`
	MaxY float64 `json:"maxY"`
}

// CanvasUser is the anonymous (or authenticated) identity of a socket peer.
type CanvasUser struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Color  string `json:"color"`
}

type LockKind string

const (
	LockKindSoft LockKind = "soft"
	LockKindHard LockKind = "hard"
)

// WidgetLock describes a live redis lock on a widget.
type WidgetLock struct {
	WidgetID string   `json:"widgetId"`
	UserID   string   `json:"userId"`
	Kind     LockKind `json:"kind"`
	TTL      int64    `json:"ttl"` // ms remaining until auto-expiry
}

// CanvasWidgetDto is a widget as streamed to the canvas on join. Coordinates are
// world-space.
type CanvasWidgetDto struct {
	ID       string       `json:"id"`
	Name     string       `json:"name"`
	Sku      string       `json:"sku"`
	Photo    *string      `json:"photo"`
	Price    float64      `json:"price"`
	Quantity int32        `json:"quantity"`
	X        float64      `json:"x"`
	Y        float64      `json:"y"`
	Width    int32        `json:"width"`
	Height   int32        `json:"height"`
	Lock     *WidgetLock  `json:"lock,omitempty"`
}

type BoardJoinResult struct {
	BoardID   string            `json:"boardId"`
	Slug      string            `json:"slug"`
	Name      string            `json:"name"`
	MaxWidth  int32             `json:"maxWidth"`
	MaxHeight int32             `json:"maxHeight"`
	Widgets   []CanvasWidgetDto `json:"widgets"`
	Peers     []CanvasUser      `json:"peers"`
	MyLocks   []WidgetLock      `json:"myLocks"`
}

// ── Client → server payloads ───────────────────────────────

type JoinPayload struct {
	Slug     string   `json:"slug"`
	Viewport Viewport `json:"viewport"`
}

type CursorMovePayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type ViewportUpdatePayload struct {
	Viewport Viewport `json:"viewport"`
}

type SoftLockPayload struct {
	WidgetID string `json:"widgetId"`
}

type WidgetMovePayload struct {
	WidgetID string  `json:"widgetId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
}

type WidgetPlacePayload struct {
	WidgetID string  `json:"widgetId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

// inboundMessage is the envelope for every client → server websocket frame.
type inboundMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// outboundMessage is the envelope for every server → client websocket frame.
type outboundMessage struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}
