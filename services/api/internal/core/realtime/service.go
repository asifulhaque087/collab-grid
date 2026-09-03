package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"sync"
	"time"

	"log/slog"

	sqlc "github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
)

const (
	softLockMS   = 60_000
	hardLockMS   = 300_000
	minLockGapMS = 120
)

var (
	adjectives = []string{"Swift", "Calm", "Brave", "Clever", "Lucky", "Bright", "Quiet", "Bold", "Gentle", "Witty", "Nimble", "Mellow"}
	animals    = []string{"Otter", "Falcon", "Panda", "Fox", "Heron", "Lynx", "Beaver", "Sparrow", "Marmot", "Bison", "Wren", "Ibex"}
	colors     = []string{"#0d9488", "#d97706", "#059669", "#6366f1", "#ec4899", "#f59e0b", "#14b8a6", "#8b5cf6", "#ef4444", "#3b82f6"}
)

var lockKeyRE = regexp.MustCompile(`^lock:([^:]+):(.+)$`)

type service struct {
	repo     RealtimeRepo
	rdb      *redis.Client
	wsSecret string
	logger   *slog.Logger
	emitter  Emitter

	mu              sync.Mutex
	lastLockAttempt map[string]int64
}

func NewService(
	repo RealtimeRepo,
	rdb *redis.Client,
	wsTokenSecret string,
	logger *slog.Logger,
	emitter Emitter,
) *service {
	return &service{
		repo:            repo,
		rdb:             rdb,
		wsSecret:        wsTokenSecret,
		logger:          logger,
		emitter:         emitter,
		lastLockAttempt: make(map[string]int64),
	}
}

// ── Identity ────────────────────────────────────────────

func (s *service) buildUser(userID, name string) CanvasUser {
	id := userID
	if id == "" {
		id = uuid.NewString()
	}
	seed := s.hash(id)
	color := colors[seed%len(colors)]
	label := name
	if label == "" {
		label = fmt.Sprintf("%s %s", adjectives[seed%len(adjectives)], animals[(seed>>3)%len(animals)])
	}
	return CanvasUser{UserID: id, Name: label, Color: color}
}

func (s *service) hash(str string) int {
	h := 0
	for i := 0; i < len(str); i++ {
		h = (h*31 + int(str[i])) | 0
	}
	if h < 0 {
		h = -h
	}
	return h
}

// ── Board + widgets ─────────────────────────────────────

func (s *service) GetRealtimeBoardBySlug(ctx context.Context, slug string) (*BoardJoinBoard, error) {
	row, err := s.repo.GetBoardBySlug(ctx, slug)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrBoardNotFound
		}
		s.logger.Error("failed to get board by slug", "slug", slug, "error", err)
		return nil, ErrInternalServer
	}

	return &BoardJoinBoard{
		ID:        row.ID.String(),
		Slug:      row.Slug,
		Name:      row.Name,
		Access:    row.Access,
		MaxWidth:  orDefaultInt4(row.MaxWidth, 10000),
		MaxHeight: orDefaultInt4(row.MaxHeight, 10000),
	}, nil
}

func (s *service) GetBoardWidgets(ctx context.Context, boardID string) ([]CanvasWidgetDto, error) {
	bid, err := parseUUID(boardID)
	if err != nil {
		return nil, err
	}

	rows, err := s.repo.GetPlacedWidgets(ctx, bid)
	if err != nil {
		s.logger.Error("failed to get placed widgets", "board_id", boardID, "error", err)
		return nil, ErrInternalServer
	}

	widgets := make([]CanvasWidgetDto, 0, len(rows))
	for _, w := range rows {
		lock, lerr := s.getLock(ctx, boardID, w.ID.String())
		if lerr != nil {
			s.logger.Warn("getLock failed", "error", lerr)
		}

		live, perr := s.getWidgetPosition(ctx, boardID, w.ID.String())
		x := numericToFloat(w.PosX)
		y := numericToFloat(w.PosY)
		if perr == nil && live != nil {
			x = live.X
			y = live.Y
		}

		widgets = append(widgets, CanvasWidgetDto{
			ID:       w.ID.String(),
			Name:     w.Name,
			Sku:      w.Sku,
			Photo:    textPtr(w.Photo),
			Price:    numericToFloat(w.Price),
			Quantity: w.Quantity,
			X:        x,
			Y:        y,
			Width:    w.Width,
			Height:   w.Height,
			Lock:     lock,
		})
	}
	return widgets, nil
}

func (s *service) PlaceWidget(ctx context.Context, boardID, widgetID string, x, y float64) (*CanvasWidgetDto, error) {
	bid, err := parseUUID(boardID)
	if err != nil {
		return nil, err
	}
	wid, err := parseUUID(widgetID)
	if err != nil {
		return nil, err
	}

	row, err := s.repo.UpdateWidgetPosition(ctx, updatePosParams(bid, wid, x, y))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrBoardNotFound
		}
		s.logger.Error("failed to place widget", "widget_id", widgetID, "error", err)
		return nil, ErrInternalServer
	}

	if err := s.SaveWidgetPosition(ctx, boardID, widgetID, x, y); err != nil {
		s.logger.Warn("failed to cache widget position", "error", err)
	}

	lock, lerr := s.getLock(ctx, boardID, widgetID)
	if lerr != nil {
		s.logger.Warn("getLock failed", "error", lerr)
	}

	return &CanvasWidgetDto{
		ID:       row.ID.String(),
		Name:     row.Name,
		Sku:      row.Sku,
		Photo:    textPtr(row.Photo),
		Price:    numericToFloat(row.Price),
		Quantity: row.Quantity,
		X:        x,
		Y:        y,
		Width:    row.Width,
		Height:   row.Height,
		Lock:     lock,
	}, nil
}

// ── Presence ────────────────────────────────────────────

func (s *service) presenceKey(boardID string) string { return "presence:" + boardID }

func (s *service) AddPresence(ctx context.Context, boardID string, user CanvasUser, socketID string) error {
	b, _ := json.Marshal(struct {
		CanvasUser
		SocketID string `json:"socketId"`
	}{CanvasUser: user, SocketID: socketID})
	return s.rdb.HSet(ctx, s.presenceKey(boardID), user.UserID, string(b)).Err()
}

func (s *service) RemovePresence(ctx context.Context, boardID, userID string) error {
	return s.rdb.HDel(ctx, s.presenceKey(boardID), userID).Err()
}

func (s *service) GetPeers(ctx context.Context, boardID, excludeUserID string) ([]CanvasUser, error) {
	all, err := s.rdb.HGetAll(ctx, s.presenceKey(boardID)).Result()
	if err != nil {
		return nil, err
	}
	peers := make([]CanvasUser, 0, len(all))
	for uid, raw := range all {
		if uid == excludeUserID {
			continue
		}
		var p CanvasUser
		if err := json.Unmarshal([]byte(raw), &p); err != nil {
			continue
		}
		peers = append(peers, CanvasUser{UserID: p.UserID, Name: p.Name, Color: p.Color})
	}
	return peers, nil
}

// ── Widget position recovery ────────────────────────────

func (s *service) widgetPosKey(boardID, widgetID string) string {
	return "widgetpos:" + boardID + ":" + widgetID
}

func (s *service) SaveWidgetPosition(ctx context.Context, boardID, widgetID string, x, y float64) error {
	b, _ := json.Marshal(struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}{X: x, Y: y})
	return s.rdb.Set(ctx, s.widgetPosKey(boardID, widgetID), string(b), time.Hour).Err()
}

func (s *service) getWidgetPosition(ctx context.Context, boardID, widgetID string) (*struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}, error) {
	raw, err := s.rdb.Get(ctx, s.widgetPosKey(boardID, widgetID)).Result()
	if err != nil {
		return nil, err
	}
	var p struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *service) SaveViewport(ctx context.Context, boardID, userID string, vp Viewport) error {
	b, _ := json.Marshal(vp)
	return s.rdb.Set(ctx, "viewport:"+boardID+":"+userID, string(b), time.Hour).Err()
}

// ── Soft / hard locks ───────────────────────────────────

func (s *service) lockKey(boardID, widgetID string) string {
	return "lock:" + boardID + ":" + widgetID
}

func (s *service) AcquireSoftLock(ctx context.Context, boardID, widgetID, userID string) (SoftLockResult, error) {
	now := time.Now().UnixMilli()
	s.mu.Lock()
	last := s.lastLockAttempt[userID]
	s.lastLockAttempt[userID] = now
	s.mu.Unlock()
	if now-last < minLockGapMS {
		return SoftLockResult{OK: false, Reason: "bot"}, nil
	}

	key := s.lockKey(boardID, widgetID)
	val, _ := json.Marshal(struct {
		UserID string   `json:"userId"`
		Kind   LockKind `json:"kind"`
	}{UserID: userID, Kind: LockKindSoft})

	ok, err := s.rdb.SetNX(ctx, key, string(val), softLockMS*time.Millisecond).Result()
	if err != nil {
		return SoftLockResult{}, err
	}
	if ok {
		return SoftLockResult{
			OK:   true,
			Lock: &WidgetLock{WidgetID: widgetID, UserID: userID, Kind: LockKindSoft, TTL: softLockMS},
		}, nil
	}

	holder, _ := s.getLock(ctx, boardID, widgetID)
	res := SoftLockResult{OK: false, Reason: "taken"}
	if holder != nil {
		res.Holder = holder.UserID
	}
	return res, nil
}

func (s *service) ReleaseLock(ctx context.Context, boardID, widgetID, userID string) error {
	holder, err := s.getLock(ctx, boardID, widgetID)
	if err != nil {
		return err
	}
	if holder != nil && holder.UserID == userID {
		return s.rdb.Del(ctx, s.lockKey(boardID, widgetID)).Err()
	}
	return nil
}

func (s *service) ReleaseAllUserLocks(ctx context.Context, boardID, userID string) ([]string, error) {
	locks, err := s.GetUserLocks(ctx, boardID, userID)
	if err != nil {
		return nil, err
	}
	released := make([]string, 0, len(locks))
	for _, l := range locks {
		if err := s.ClearLock(ctx, boardID, l.WidgetID); err != nil {
			s.logger.Warn("clearLock failed", "widget_id", l.WidgetID, "error", err)
			continue
		}
		released = append(released, l.WidgetID)
	}
	return released, nil
}

func (s *service) getLock(ctx context.Context, boardID, widgetID string) (*WidgetLock, error) {
	key := s.lockKey(boardID, widgetID)
	raw, err := s.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var parsed struct {
		UserID string   `json:"userId"`
		Kind   LockKind `json:"kind"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	ttl, err := s.rdb.PTTL(ctx, key).Result()
	if err != nil {
		ttl = 0
	}
	return &WidgetLock{
		WidgetID: widgetID,
		UserID:   parsed.UserID,
		Kind:     parsed.Kind,
		TTL:      ttl.Milliseconds(),
	}, nil
}

func (s *service) GetUserLocks(ctx context.Context, boardID, userID string) ([]WidgetLock, error) {
	prefix := s.lockKey(boardID, "")
	var cursor uint64
	locks := make([]WidgetLock, 0)
	for {
		keys, next, err := s.rdb.Scan(ctx, cursor, prefix+"*", 100).Result()
		if err != nil {
			return nil, err
		}
		cursor = next
		for _, key := range keys {
			raw, err := s.rdb.Get(ctx, key).Result()
			if err != nil {
				continue
			}
			var parsed struct {
				UserID string   `json:"userId"`
				Kind   LockKind `json:"kind"`
			}
			if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
				continue
			}
			if parsed.UserID != userID {
				continue
			}
			ttl, _ := s.rdb.PTTL(ctx, key).Result()
			locks = append(locks, WidgetLock{
				WidgetID: key[len(prefix):],
				UserID:   userID,
				Kind:     parsed.Kind,
				TTL:      ttl.Milliseconds(),
			})
		}
		if cursor == 0 {
			break
		}
	}
	return locks, nil
}

func (s *service) hardSetKey(boardID string) string { return "hardlocks:" + boardID }
func (s *service) paidKey(boardID, widgetID string) string {
	return "paid:" + boardID + ":" + widgetID
}

func (s *service) PromoteToHardLocks(ctx context.Context, boardID, userID string) ([]string, error) {
	locks, err := s.GetUserLocks(ctx, boardID, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(locks))
	for _, l := range locks {
		key := s.lockKey(boardID, l.WidgetID)
		exists, err := s.rdb.Exists(ctx, key).Result()
		if err != nil || exists == 0 {
			continue
		}
		val, _ := json.Marshal(struct {
			UserID string   `json:"userId"`
			Kind   LockKind `json:"kind"`
		}{UserID: userID, Kind: LockKindHard})
		if err := s.rdb.Set(ctx, key, string(val), hardLockMS*time.Millisecond).Err(); err != nil {
			s.logger.Warn("promote hard lock failed", "widget_id", l.WidgetID, "error", err)
			continue
		}
		if err := s.rdb.SAdd(ctx, s.hardSetKey(boardID), l.WidgetID).Err(); err != nil {
			s.logger.Warn("sadd hard lock failed", "error", err)
		}
		ids = append(ids, l.WidgetID)
	}
	return ids, nil
}

func (s *service) MarkPaid(ctx context.Context, boardID, widgetID string) error {
	return s.rdb.Set(ctx, s.paidKey(boardID, widgetID), "1", 10*time.Minute).Err()
}

func (s *service) ResolveExpiredLock(ctx context.Context, boardID, widgetID string) (string, error) {
	wasHard, err := s.rdb.SRem(ctx, s.hardSetKey(boardID), widgetID).Result()
	if err != nil {
		return "", err
	}
	if wasHard == 0 {
		return "soft", nil
	}
	paid, err := s.rdb.Get(ctx, s.paidKey(boardID, widgetID)).Result()
	if err != nil && err != redis.Nil {
		return "", err
	}
	if paid == "1" {
		_ = s.rdb.Del(ctx, s.paidKey(boardID, widgetID))
		return "hard-purchased", nil
	}
	return "hard-released", nil
}

func (s *service) userHoldsLock(ctx context.Context, boardID, widgetID, userID string) (bool, error) {
	lock, err := s.getLock(ctx, boardID, widgetID)
	if err != nil {
		return false, err
	}
	return lock != nil && lock.UserID == userID, nil
}

func (s *service) ClearLock(ctx context.Context, boardID, widgetID string) error {
	if err := s.rdb.Del(ctx, s.lockKey(boardID, widgetID)).Err(); err != nil {
		return err
	}
	if err := s.rdb.SRem(ctx, s.hardSetKey(boardID), widgetID).Err(); err != nil {
		return err
	}
	return s.rdb.Del(ctx, s.paidKey(boardID, widgetID)).Err()
}

func (s *service) RemoveWidget(ctx context.Context, boardID, widgetID string) error {
	bid, err := parseUUID(boardID)
	if err != nil {
		return err
	}
	wid, err := parseUUID(widgetID)
	if err != nil {
		return err
	}
	if err := s.repo.RemoveWidget(ctx, sqlc.RemoveWidgetParams{ID: wid, BoardID: bid}); err != nil {
		return err
	}
	return s.rdb.Del(ctx, s.widgetPosKey(boardID, widgetID)).Err()
}

func (s *service) ParseLockKey(key string) (string, string, bool) {
	m := lockKeyRE.FindStringSubmatch(key)
	if m == nil {
		return "", "", false
	}
	return m[1], m[2], true
}

// ── Complete purchase (called by the order flow) ────────

func (s *service) CompletePurchase(ctx context.Context, boardID pgtype.UUID, widgetIDs []pgtype.UUID, buyerUserID string) error {
	boardStr := boardID.String()
	for _, wid := range widgetIDs {
		widgetStr := wid.String()
		if err := s.RemoveWidget(ctx, boardStr, widgetStr); err != nil {
			s.logger.Warn("remove widget failed", "widget_id", widgetStr, "error", err)
		}
		if err := s.ClearLock(ctx, boardStr, widgetStr); err != nil {
			s.logger.Warn("clear lock failed", "widget_id", widgetStr, "error", err)
		}
		if s.emitter != nil {
			s.emitter.EmitToRoom(BoardRoom(boardStr), "widget:purchased", map[string]string{"widgetId": widgetStr})
		}
	}

	if buyerUserID != "" {
		released, err := s.ReleaseAllUserLocks(ctx, boardStr, buyerUserID)
		if err != nil {
			return err
		}
		for _, widgetID := range released {
			if s.emitter != nil {
				s.emitter.EmitToRoom(BoardRoom(boardStr), "widget:lock:soft:release", map[string]string{"widgetId": widgetID})
			}
		}
	}
	return nil
}

// UserHoldsLock reports whether the given user currently holds the lock on a
// widget. Used by the order flow to confirm the buyer actually reserved the item
// and the hard-lock window hasn't lapsed.
func (s *service) UserHoldsLock(ctx context.Context, boardID pgtype.UUID, widgetID pgtype.UUID, buyerUserID string) bool {
	ok, err := s.userHoldsLock(ctx, boardID.String(), widgetID.String(), buyerUserID)
	if err != nil {
		s.logger.Warn("userHoldsLock check failed", "error", err)
		return false
	}
	return ok
}

// ── Expiry watcher (Redis keyspace notifications) ──────

func (s *service) StartExpiryWatcher(ctx context.Context) {
	if s.rdb == nil {
		return
	}
	pubsub := s.rdb.PSubscribe(ctx, "__keyevent@*__:expired")
	_, err := pubsub.Receive(ctx)
	if err != nil {
		s.logger.Warn("redis keyspace expiry subscription failed; lock auto-release disabled", "error", err)
		return
	}
	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			boardID, widgetID, ok := s.ParseLockKey(msg.Payload)
			if !ok {
				continue
			}
			outcome, err := s.ResolveExpiredLock(ctx, boardID, widgetID)
			if err != nil {
				s.logger.Warn("resolve expired lock failed", "error", err)
				continue
			}
			if s.emitter == nil {
				continue
			}
			switch outcome {
			case "soft":
				s.emitter.EmitToRoom(BoardRoom(boardID), "widget:lock:soft:release", map[string]string{"widgetId": widgetID})
			case "hard-released":
				s.emitter.EmitToRoom(BoardRoom(boardID), "widget:lock:hard:release", map[string]string{"widgetId": widgetID})
			case "hard-purchased":
				if err := s.RemoveWidget(ctx, boardID, widgetID); err != nil {
					s.logger.Warn("remove purchased widget failed", "error", err)
				}
				s.emitter.EmitToRoom(BoardRoom(boardID), "widget:purchased", map[string]string{"widgetId": widgetID})
			}
		}
	}()
}

// ── helpers ─────────────────────────────────────────────

func (s *service) CanManageWidgets(ctx context.Context, userID string) (bool, error) {
	uid, err := parseUUID(userID)
	if err != nil {
		return false, nil
	}
	grants, err := s.repo.GetUserWidgetPermissions(ctx, uid)
	if err != nil {
		s.logger.Error("failed to load user permissions", "error", err)
		return false, ErrInternalServer
	}
	for _, g := range grants {
		if g.Action == "update" && g.Subject == "SmartWidget" {
			return true, nil
		}
	}
	return false, nil
}

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	v, err := n.Float64Value()
	if err != nil || !v.Valid {
		return 0
	}
	return v.Float64
}

func floatToNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	_ = n.Scan(strconv.FormatFloat(f, 'f', -1, 64))
	return n
}

func orDefaultInt4(n pgtype.Int4, def int32) int32 {
	if n.Valid {
		return n.Int32
	}
	return def
}

func textPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	v := t.String
	return &v
}

func parseUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, ErrInternalServer
	}
	return id, nil
}

func isNoRows(err error) bool {
	return err != nil && (errors.Is(err, pgx.ErrNoRows) || err == redis.Nil)
}

func updatePosParams(bid, wid pgtype.UUID, x, y float64) sqlc.UpdateWidgetPositionParams {
	return sqlc.UpdateWidgetPositionParams{
		PosX:    floatToNumeric(x),
		PosY:    floatToNumeric(y),
		ID:      wid,
		BoardID: bid,
	}
}
