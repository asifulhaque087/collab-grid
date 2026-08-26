package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func keysOf(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// RealtimeGateway is the websocket endpoint. It owns the Hub and dispatches
// incoming frames to the RealtimeService, broadcasting results to board/zone rooms.
type RealtimeGateway struct {
	hub        *Hub
	svc        *service
	zone       *ZoneService
	socketAuth *SocketAuthService
	rabbit     *RabbitmqService
	logger     *slog.Logger

	upgrader websocket.Upgrader
}

func NewRealtimeGateway(
	hub *Hub,
	svc *service,
	zone *ZoneService,
	socketAuth *SocketAuthService,
	rabbit *RabbitmqService,
	logger *slog.Logger,
) *RealtimeGateway {
	return &RealtimeGateway{
		hub:        hub,
		svc:        svc,
		zone:       zone,
		socketAuth: socketAuth,
		rabbit:     rabbit,
		logger:     logger,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// ServeWS upgrades an HTTP request to a websocket and wires up the client pumps.
func (g *RealtimeGateway) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := g.upgrader.Upgrade(w, r, nil)
	if err != nil {
		g.logger.Warn("websocket upgrade failed", "error", err.Error())
		return
	}

	client := &Client{
		hub:      g.hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		zones:    make(map[string]bool),
	}

	g.handleConnection(client, r)
	g.hub.Register(client)

	go client.writePump()
	go client.readPump(g)
}

// handleConnection mints/rehydrates the socket identity and emits the session.
func (g *RealtimeGateway) handleConnection(client *Client, r *http.Request) {
	auth := readHandshakeAuth(r)
	if token := auth["token"]; token != "" {
		if id, _, ok := g.socketAuth.VerifyWsToken(token); ok {
			client.wsUserID = id
		}
	}
	userID := client.wsUserID
	if userID == "" {
		userID = auth["userId"]
	}
	client.user = g.svc.buildUser(userID, auth["name"])
	client.socketID = randomSocketID()
	g.hub.EmitToClient(client, "session", client.user)
}

func readHandshakeAuth(r *http.Request) map[string]string {
	out := map[string]string{}
	if r.URL.Query().Get("token") != "" {
		out["token"] = r.URL.Query().Get("token")
	}
	// gorilla does not expose handshake auth map; the client passes it as query
	// params (?token=&userId=&name=) which we read here.
	if v := r.URL.Query().Get("userId"); v != "" {
		out["userId"] = v
	}
	if v := r.URL.Query().Get("name"); v != "" {
		out["name"] = v
	}
	return out
}

func (c *Client) readPump(g *RealtimeGateway) {
	defer func() {
		g.hub.Unregister(c)
		_ = c.conn.Close()
	}()

	c.conn.SetReadLimit(1 << 20)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				g.logger.Debug("ws read error", "error", err.Error())
			}
			break
		}
		g.dispatch(c, data)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)
			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (g *RealtimeGateway) dispatch(c *Client, data []byte) {
	var msg inboundMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}
	ctx := context.Background()

	switch msg.Type {
	case "board:join:private":
		g.onPrivateJoin(ctx, c, msg.Payload)
	case "board:join:public":
		g.onPublicJoin(ctx, c, msg.Payload)
	case "cursor:move:send":
		g.onCursorMove(ctx, c, msg.Payload)
	case "viewport:update":
		g.onViewportUpdate(ctx, c, msg.Payload)
	case "widget:lock:soft:init":
		g.onSoftLock(ctx, c, msg.Payload)
	case "widget:lock:soft:release:init":
		g.onSoftRelease(ctx, c, msg.Payload)
	case "widget:lock:hard:init":
		g.onHardLock(ctx, c)
	case "widget:move":
		g.onWidgetMove(ctx, c, msg.Payload, false)
	case "widget:move:end":
		g.onWidgetMove(ctx, c, msg.Payload, true)
	case "widget:place":
		g.onWidgetPlace(ctx, c, msg.Payload)
	}
}

func (g *RealtimeGateway) onPrivateJoin(ctx context.Context, c *Client, raw json.RawMessage) {
	if c.wsUserID == "" {
		g.hub.EmitToClient(c, "board:join:result", map[string]string{"error": ErrAuthRequired.Error()})
		return
	}
	var p JoinPayload
	_ = json.Unmarshal(raw, &p)
	board, err := g.svc.GetRealtimeBoardBySlug(ctx, p.Slug)
	if err != nil {
		g.emitJoinError(c, err)
		return
	}
	canMove, _ := g.socketAuth.CanManageWidgets(ctx, c.wsUserID)
	c.boardID = board.ID
	c.canMove = canMove
	g.doJoin(ctx, c, board, p.Viewport)
}

func (g *RealtimeGateway) onPublicJoin(ctx context.Context, c *Client, raw json.RawMessage) {
	var p JoinPayload
	_ = json.Unmarshal(raw, &p)
	board, err := g.svc.GetRealtimeBoardBySlug(ctx, p.Slug)
	if err != nil {
		g.emitJoinError(c, err)
		return
	}
	if board.Access != "public" {
		g.hub.EmitToClient(c, "board:join:result", map[string]string{"error": ErrBoardNotPublished.Error()})
		return
	}
	c.boardID = board.ID
	c.canMove = false
	g.doJoin(ctx, c, board, p.Viewport)
}

func (g *RealtimeGateway) emitJoinError(c *Client, err error) {
	if err == ErrBoardNotFound {
		g.hub.EmitToClient(c, "board:join:result", map[string]string{"error": ErrBoardNotFound.Error()})
		return
	}
	g.hub.EmitToClient(c, "board:join:result", map[string]string{"error": ErrInternalServer.Error()})
}

func (g *RealtimeGateway) doJoin(ctx context.Context, c *Client, board *BoardJoinBoard, vp Viewport) {
	boardRoom := g.zone.BoardRoom(board.ID)
	g.hub.JoinRoom(c, boardRoom)

	zones := g.zone.CalculateOverlappingZones(vp)
	for _, z := range zones {
		g.hub.JoinRoom(c, g.zone.Room(board.ID, z))
	}
	c.zones = map[string]bool{}
	for _, z := range zones {
		c.zones[z] = true
	}

	_ = g.svc.AddPresence(ctx, board.ID, c.user, c.socketID)
	_ = g.svc.SaveViewport(ctx, board.ID, c.user.UserID, vp)

	widgets, err := g.svc.GetBoardWidgets(ctx, board.ID)
	if err != nil {
		widgets = []CanvasWidgetDto{}
	}
	peers, err := g.svc.GetPeers(ctx, board.ID, c.user.UserID)
	if err != nil {
		peers = []CanvasUser{}
	}
	myLocks, err := g.svc.GetUserLocks(ctx, board.ID, c.user.UserID)
	if err != nil {
		myLocks = []WidgetLock{}
	}

	result := BoardJoinResult{
		BoardID:   board.ID,
		Slug:      board.Slug,
		Name:      board.Name,
		MaxWidth:  board.MaxWidth,
		MaxHeight: board.MaxHeight,
		Widgets:   widgets,
		Peers:     peers,
		MyLocks:   myLocks,
	}
	g.hub.EmitToClient(c, "board:join:result", result)
	g.hub.EmitToRoomExcept(boardRoom, "peer:joined", c.user, c)
}

func (g *RealtimeGateway) onCursorMove(ctx context.Context, c *Client, raw json.RawMessage) {
	if c.boardID == "" {
		return
	}
	var p CursorMovePayload
	_ = json.Unmarshal(raw, &p)
	zone := g.zone.ZoneForPoint(p.X, p.Y)
	if zone == "" {
		return
	}
	body := map[string]any{
		"userId": c.user.UserID,
		"name":   c.user.Name,
		"color":  c.user.Color,
		"x":      p.X,
		"y":      p.Y,
	}
	g.hub.EmitToRoomExcept(g.zone.Room(c.boardID, zone), "cursor:move:receive", body, c)
}

func (g *RealtimeGateway) onViewportUpdate(ctx context.Context, c *Client, raw json.RawMessage) {
	if c.boardID == "" {
		return
	}
	var p ViewportUpdatePayload
	_ = json.Unmarshal(raw, &p)
	_ = g.svc.SaveViewport(ctx, c.boardID, c.user.UserID, p.Viewport)

	next := map[string]bool{}
	for _, z := range g.zone.CalculateOverlappingZones(p.Viewport) {
		next[z] = true
	}
	for z := range c.zones {
		if !next[z] {
			g.hub.LeaveRoom(c, g.zone.Room(c.boardID, z))
		}
	}
	for z := range next {
		if !c.zones[z] {
			g.hub.JoinRoom(c, g.zone.Room(c.boardID, z))
		}
	}
	c.zones = next
	g.hub.EmitToClient(c, "viewport:synchronized", map[string]any{"zones": keysOf(next)})
}

func (g *RealtimeGateway) onSoftLock(ctx context.Context, c *Client, raw json.RawMessage) {
	if c.boardID == "" {
		return
	}
	var p SoftLockPayload
	_ = json.Unmarshal(raw, &p)

	res, err := g.svc.AcquireSoftLock(ctx, c.boardID, p.WidgetID, c.user.UserID)
	if err != nil {
		return
	}
	if !res.OK {
		if res.Reason == "bot" {
			g.hub.EmitToClient(c, "widget:lock:soft:denied", map[string]any{
				"widgetId": p.WidgetID,
				"reason":   "Too many rapid actions — slow down.",
			})
			return
		}
		g.hub.EmitToClient(c, "widget:lock:soft:denied", map[string]any{
			"widgetId": p.WidgetID,
			"reason":   "Someone else already locked this item.",
		})
		return
	}

	body := map[string]any{
		"widgetId": p.WidgetID,
		"userId":   c.user.UserID,
		"name":     c.user.Name,
		"ttl":      res.Lock.TTL,
	}
	g.hub.EmitToRoom(g.zone.BoardRoom(c.boardID), "widget:lock:soft:fixed", body)
}

func (g *RealtimeGateway) onSoftRelease(ctx context.Context, c *Client, raw json.RawMessage) {
	if c.boardID == "" {
		return
	}
	var p SoftLockPayload
	_ = json.Unmarshal(raw, &p)

	_ = g.svc.ReleaseLock(ctx, c.boardID, p.WidgetID, c.user.UserID)
	g.hub.EmitToRoom(g.zone.BoardRoom(c.boardID), "widget:lock:soft:release", map[string]string{"widgetId": p.WidgetID})
}

func (g *RealtimeGateway) onHardLock(ctx context.Context, c *Client) {
	if c.boardID == "" {
		return
	}
	widgetIDs, err := g.svc.PromoteToHardLocks(ctx, c.boardID, c.user.UserID)
	if err != nil || len(widgetIDs) == 0 {
		return
	}
	g.hub.EmitToRoom(g.zone.BoardRoom(c.boardID), "widget:lock:hard:fixed", map[string]any{
		"widgetIds": widgetIDs,
		"userId":    c.user.UserID,
		"ttl":       hardLockMS,
	})
}

func (g *RealtimeGateway) onWidgetMove(ctx context.Context, c *Client, raw json.RawMessage, end bool) {
	if c.boardID == "" || !c.canMove {
		return
	}
	var p WidgetMovePayload
	_ = json.Unmarshal(raw, &p)

	_ = g.svc.SaveWidgetPosition(ctx, c.boardID, p.WidgetID, p.X, p.Y)
	if end {
		g.rabbit.Publish(ctx, WidgetPositionMessage{BoardID: c.boardID, WidgetID: p.WidgetID, X: p.X, Y: p.Y})
	} else {
		g.rabbit.PublishDebounced(ctx, WidgetPositionMessage{BoardID: c.boardID, WidgetID: p.WidgetID, X: p.X, Y: p.Y}, 400)
	}

	event := "widget:moved"
	if end {
		event = "widget:anchored"
	}
	body := map[string]any{"widgetId": p.WidgetID, "x": p.X, "y": p.Y}
	for _, z := range g.zone.CalculateWidgetOverlappingZones(p.X, p.Y, p.Width, p.Height) {
		g.hub.EmitToRoomExcept(g.zone.Room(c.boardID, z), event, body, c)
	}
}

func (g *RealtimeGateway) onWidgetPlace(ctx context.Context, c *Client, raw json.RawMessage) {
	if c.boardID == "" || !c.canMove {
		return
	}
	var p WidgetPlacePayload
	_ = json.Unmarshal(raw, &p)

	widget, err := g.svc.PlaceWidget(ctx, c.boardID, p.WidgetID, p.X, p.Y)
	if err != nil || widget == nil {
		return
	}
	for _, z := range g.zone.CalculateWidgetOverlappingZones(float64(widget.X), float64(widget.Y), float64(widget.Width), float64(widget.Height)) {
		g.hub.EmitToRoomExcept(g.zone.Room(c.boardID, z), "widget:placed", widget, c)
	}
}

func randomSocketID() string {
	return uuid.NewString()
}
