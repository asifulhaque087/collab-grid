# LootBoard — Backend Architecture & Engineering Deep-Dive

> How the Go backend solves the hard problems behind a real-time collaborative commerce
> canvas: concurrent ownership without race conditions, double-payment prevention, surviving
> 60 fps WebSocket write storms without melting the database, viewport-scoped broadcasting, and
> a plan-aware RBAC system.

This document is **backend-only** and **problem-first**. Each section names a classic distributed-
systems / web-engineering problem, then walks the exact mechanism in this codebase that solves it,
with file references. The most complex and interesting problems are at the top.

**Stack:** Go (chi) · PostgreSQL + SQLC + Goose · Redis (go-redis) · RabbitMQ (amqp091-go) · gorilla/websocket · Casbin.

---

## Table of Contents

1. [Race Conditions on Shared Inventory — Atomic Distributed Locks](#1-race-conditions-on-shared-inventory--atomic-distributed-locks)
2. [60 fps WebSocket Write Storms — Write-Behind Cache + Debounced Persistence](#2-60-fps-websocket-write-storms--write-behind-cache--debounced-persistence)
3. [Zero Double-Payment — Idempotency + Server-Authoritative Checkout](#3-zero-double-payment--idempotency--server-authoritative-checkout)
4. [Auto-Expiring Reservations — Redis Keyspace Notifications as an Event Bus](#4-auto-expiring-reservations--redis-keyspace-notifications-as-an-event-bus)
5. [Viewport Rate-Limiting — Spatial Zone Sharding of the Broadcast Fan-out](#5-viewport-rate-limiting--spatial-zone-sharding-of-the-broadcast-fan-out)
6. [Bot / Abuse Detection — Mouse-Teleportation Guard](#6-bot--abuse-detection--mouse-teleportation-guard)
7. [WebSocket Authentication & Privilege Gating](#7-websocket-authentication--privilege-gating)
8. [Plan-Aware RBAC — Casbin Policies + Quota Snapshots](#8-plan-aware-rbac--casbin-policies--quota-snapshots)
9. [Failure Tolerance & Graceful Degradation](#9-failure-tolerance--graceful-degradation)
10. [Scaling the WebSocket Tier — Redis Pub/Sub Backplane](#10-scaling-the-websocket-tier--redis-pubsub-backplane)
11. [Module Map & Data Stores](#11-module-map--data-stores)

---

## 1. Race Conditions on Shared Inventory — Atomic Distributed Locks

**The problem.** Many anonymous shoppers look at the same canvas. Two of them click the same
sneaker at the same millisecond. A naive "read row → check available → mark taken" sequence has a
TOCTOU race: both reads see "available," both write "taken," both proceed to checkout. SQL row
locks (`SELECT … FOR UPDATE`) serialize this but buckle under flash-sale burst velocity and hold
DB connections hostage for the entire human "thinking" time of a checkout.

**The solution — a single atomic Redis operation.** Ownership is modeled as a lock _key_ in Redis,
acquired with `SET key value NX PX ttl`. Redis is single-threaded, so `NX` ("set only if Not
eXists") is atomically all-or-nothing: exactly one of the two concurrent clients gets `OK`, the
other gets `null`. No transaction, no row lock, no DB round-trip.

```go
// service/realtime/service.go — AcquireSoftLock()
ok, err := s.rdb.SetNX(ctx, key, string(val), softLockMS*time.Millisecond).Result()
if ok {
    return SoftLockResult{
        OK:   true,
        Lock: &WidgetLock{WidgetID: widgetID, UserID: userID, Kind: LockKindSoft, TTL: softLockMS},
    }, nil
}
holder, _ := s.getLock(ctx, boardID, widgetID)
return SoftLockResult{OK: false, Reason: "taken", Holder: holder?.UserID}, nil
```

The lock carries its own **TTL** (`PX 60000`), so a shopper who locks an item and then closes
their laptop cannot strand inventory forever — Redis evicts the key after 60 seconds and the item
frees itself (see §4). The lock value is JSON `{ userId, kind }` so the server always knows _who_
holds it and whether it is a soft or hard lock.

### The three-state lock lifecycle

```
  OPEN ──click──► SOFT LOCK (amber, 60s) ──checkout──► HARD LOCK (red, 5min) ──pay──► COMMITTED
   ▲                    │                                    │
   └──── TTL expiry ────┴──────────── TTL expiry ────────────┘  (auto-release, item returns)
```

| Transition                   | Mechanism                                                                        | File                                     |
| ---------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| Acquire soft lock            | `SETNX` with `PX 60000`                                                         | `service/realtime/service.go:AcquireSoftLock` |
| Promote to hard lock         | `SET` same key `PX 300000`, add widget to `hardlocks:<board>` set               | `service/realtime/service.go:PromoteToHardLock` |
| Verify ownership at checkout | `getLock` → compare `userId`                                                     | `service/realtime/service.go:getLock`    |
| Release / expire             | Key TTL fires keyspace event                                                     | §4                                       |

---

## 2. 60 fps WebSocket Write Storms — Write-Behind Cache + Debounced Persistence

**The problem.** When a tenant drags a widget across the canvas, the client emits a `widget:move`
event on every animation frame — easily **30–60 events/second per dragged widget**. If each event
triggered an `UPDATE smart_widget SET pos…`, a few simultaneous drags would saturate the connection
pool and turn PostgreSQL into the bottleneck for the entire app. But peers still need to see the
widget glide in real time, and a refresh must recover the latest position.

**The solution — a two-tier write-behind cache.** The durable database write is decoupled from the
real-time hot path entirely:

```
 client drag (≈60 fps)
        │  widget:move
        ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Gateway.onWidgetMove()                                            │
 │  1. Redis SET widgetpos:<board>:<widget>  (write-behind cache)    │  ← O(1), every frame
 │  2. rabbit.PublishDebounced(...)          (coalesce 400ms)        │  ← at most ~2-3 writes/sec
 │  3. broadcast widget:moved to overlapping zones                   │  ← peers see it instantly
 └──────────────────────────────────────────────────────────────────┘
        │ (400ms after the last frame)
        ▼
 RabbitMQ  widget.position queue (durable)
        ▼
 WidgetPersistenceConsumer → single UPDATE smart_widget …  ← Postgres sees ~1 write per drag
```

Three layers, each doing exactly one job:

1. **Redis write-behind cache** (`SaveWidgetPosition`, TTL 1h). Every frame writes the live
   coordinates to Redis. This is the read-recovery source: when anyone joins or refreshes,
   `GetBoardWidgets` prefers the Redis position over the (possibly stale) DB `posX/posY`, so the
   canvas is always consistent even though the DB write hasn't landed yet.

   ```go
   // GetBoardWidgets() — Redis is the source of truth for in-flight positions
   live, perr := s.getWidgetPosition(ctx, boardID, w.ID.String())
   x := numericToFloat(w.PosX)
   y := numericToFloat(w.PosY)
   if perr == nil && live != nil {
       x = live.X
       y = live.Y
   }
   ```

2. **RabbitMQ debounced persistence.** `PublishDebounced` keeps a per-widget `time.Timer`; a burst
   of 60 moves collapses into **one** queued message 400 ms after the drag settles.
   `widget:move:end` calls `Publish`, which flushes the pending timer and persists immediately — so
   the final resting position is never lost to debounce.

   ```go
   // service/realtime/rabbitmq.go — per-widget debounce map
   func (r *RabbitmqService) PublishDebounced(ctx context.Context, msg WidgetPositionMessage, delayMs int) {
       r.mu.Lock()
       if t, ok := r.debounce[msg.WidgetID]; ok {
           t.Stop()
       }
       r.debounce[msg.WidgetID] = time.AfterFunc(time.Duration(delayMs)*time.Millisecond, func() {
           _ = r.send(ctx, msg)
       })
       r.mu.Unlock()
   }
   ```

3. **The consumer** (`WidgetPersistenceConsumer`) drains the durable queue and performs the only
   PostgreSQL write — board-scoped (`id = widget AND boardId = board`) so a spoofed widgetId can
   never touch another board's row. On handler failure it `nack`s without requeue, dropping a
   poison position rather than looping forever.

**Net effect:** PostgreSQL sees roughly **one write per drag gesture** instead of sixty per second,
while peers get a smooth 60 fps stream and refreshes stay perfectly consistent. This is the textbook
"write-behind cache" pattern, with RabbitMQ adding durability + back-pressure between the hot path
and the database.

---

## 3. Zero Double-Payment — Idempotency + Server-Authoritative Checkout

**The problem.** Networks retry. A shopper double-clicks "Pay," or their browser resends the POST
after a timeout, or two tabs submit. Without protection that's two orders and two charges for one
cart. Separately, a malicious client could POST a forged `total` of `$0.01`, or try to buy items
they never reserved.

**The solution — four stacked guarantees** in the order service:

1. **Idempotency key (pre-check).** Every checkout carries a client-generated UUID stored on a
   **unique** `order.idempotencyKey` column. A repeated submit finds the existing row and returns
   the _original_ order — no second insert, no second charge:

   ```go
   existing, err := q.GetOrderByIdempotencyKey(ctx, dto.IdempotencyKey)
   if err == nil {
       return &OrderResult{OrderID: existing.ID, Duplicate: true}, nil
   }
   ```

2. **Idempotency key (race fallback).** Two requests can pass the pre-check simultaneously. The DB
   `UNIQUE` constraint is the real arbiter: the second `INSERT` throws a unique violation, which is
   caught and converted back into "return the original order" — so even a true concurrent
   double-submit yields one order.

3. **Lock verification.** Before charging, the server confirms the buyer _actually holds a live
   lock_ on every widget (`realtime.userHoldsLock`). You cannot buy what you didn't reserve, and a
   lapsed 5-minute hard-lock window blocks the purchase.

4. **Server-authoritative total.** The amount is recomputed from the database rows, never read from
   the client payload:
   ```go
   total := 0.0
   for _, item := range items {
       total += item.Price
   }
   ```

The order insert + line items run in a single **Unit of Work transaction**, and only after the
transaction commits does the order gateway clear Redis locks and broadcast `widget:purchased` to
every viewer so the item leaves all canvases at once.

---

## 4. Auto-Expiring Reservations — Redis Keyspace Notifications as an Event Bus

**The problem.** A soft lock must auto-release after 60 s and a hard lock after 5 min — _and every
connected client's canvas must update the instant it does_. Polling Redis for expired keys is
wasteful and laggy; a per-lock goroutine is lost on restart and doesn't survive multiple server
instances.

**The solution — let Redis itself fire the event.** Redis is started with
`--notify-keyspace-events Ex` (see `docker-compose.yml`), which publishes a message on
`__keyevent@*__:expired` the moment any key with a TTL dies. A **dedicated** Redis subscriber
connection (go-redis `Subscribe` puts the client into subscriber mode) listens and routes:

```go
// service/realtime/service.go — StartExpiryWatcher()
pubsub := s.rdb.Subscribe(ctx, "__keyevent@*__:expired")
ch := pubsub.Channel()
for msg := range ch {
    parsed := parseLockKey(msg.Payload) // lock:<board>:<widget>
    if parsed != nil {
        s.handleLockExpiry(ctx, parsed.BoardID, parsed.WidgetID)
    }
}
```

`handleLockExpiry` then classifies the expiry and the hub broadcasts the right event:

| Outcome          | Meaning                                      | Broadcast                                 |
| ---------------- | -------------------------------------------- | ----------------------------------------- |
| `soft`           | A 60 s soft lock lapsed                      | `widget:lock:soft:release` (amber → open) |
| `hard-released`  | A 5 min hard lock lapsed unpaid              | `widget:lock:hard:release` (red → open)   |
| `hard-purchased` | Hard lock expired but a `paid:` flag was set | delete widget + `widget:purchased`        |

This turns Redis TTL into a **reliable, server-driven event source** — no polling, no in-process
timers, and it works identically whether the lock expires in 1 second or 5 minutes.

---

## 5. Viewport Rate-Limiting — Spatial Zone Sharding of the Broadcast Fan-out

**The problem.** "Broadcast every cursor move and widget move to everyone on the board" is O(users²)
bandwidth. With hundreds of shoppers on a large canvas, a user panned to the top-left corner would
still receive a firehose of updates for widgets they cannot see — wasted server egress and wasted
client CPU.

**The solution — partition space, subscribe to what you can see.** `ZoneService` divides the fixed
10,000 × 10,000 world into a **10 × 10 grid of 1,000 px zones**, mapped onto Hub rooms
(`board:<id>:zone:<x>_<y>`). Each client subscribes only to the zones its current viewport overlaps;
the server fans an event out only to those zones.

```go
// service/realtime/zone.go — a viewport (or widget bbox) → the set of zones it overlaps
func (z *ZoneService) CalculateOverlappingZones(vp Viewport) []string   // rooms to join
func (z *ZoneService) CalculateWidgetOverlappingZones(x, y, w, h) []string  // rooms to broadcast a widget into
```

**Dynamic re-subscription on pan.** When a client sends `viewport:update`, the gateway diffs the new
zone set against the old one and only `JoinRoom`/`LeaveRoom` the delta — it doesn't churn the whole
subscription:

```go
// service/realtime/gateway.go — onViewportUpdate()
for z := range oldZones {
    if !next[z] {
        g.hub.LeaveRoom(client, g.zone.Room(boardID, z))
    }
}
for z := range next {
    if !oldZones[z] {
        g.hub.JoinRoom(client, g.zone.Room(boardID, z))
    }
}
```

**Two broadcast scopes** are deliberately distinguished:

- **Zone rooms** — high-frequency, spatially-local events (`cursor:move`, `widget:moved`,
  `widget:placed`). A widget move is published into exactly the zones its bounding box overlaps, so
  only viewers looking there are billed the bandwidth.
- **Board-wide room** (`board:<id>`) — events everyone must see regardless of where they're looking
  (presence join/leave, lock state changes). Lock color must be globally consistent, so it ignores
  zones.

This keeps per-event fan-out proportional to _viewers of the affected region_, not total users —
the core "stream only what's in the viewport" non-functional requirement.

---

## 6. Bot / Abuse Detection — Mouse-Teleportation Guard

**The problem.** A script can fire lock requests faster than any human hand, sniping inventory or
DoS-ing the lock system.

**The solution.** `AcquireSoftLock` keeps the timestamp of each user's last lock attempt in an
in-memory map and rejects anything faster than a human could physically click
(`minLockGapMS = 120`). The gateway surfaces this distinctly from a normal "already locked"
denial so the UI can say "Too many rapid actions — slow down."

```go
// service/realtime/service.go
now := time.Now().UnixMilli()
s.mu.Lock()
last := s.lastLockAttempt[userID]
s.lastLockAttempt[userID] = now
s.mu.Unlock()
if now-last < minLockGapMS {
    return SoftLockResult{OK: false, Reason: "bot"}, nil
}
```

_(Per-instance heuristic today; in a multi-node deployment this would move to a Redis counter so the
rate window is shared across nodes — see §10.)_

---

## 7. WebSocket Authentication & Privilege Gating

**The problem.** REST routes are protected by middleware, but a WebSocket connection is long-lived and
anonymous by default. End users join boards with no account at all, yet only the tenant (or a
permitted sub-user) may _move_ or _place_ widgets — and unpublished boards must not be joinable by
strangers.

**The solution — authenticate once at join, cache the verdict.** `SocketAuthService` verifies a
short-lived JWT exchanged via `/api/v1/realtime/token-exchange` and passed as a query parameter
`?token=` during the WebSocket handshake. The trust model is identical to the REST middleware (no
separate token channel). Anonymous end users simply resolve to `nil`.

Two gates are resolved a single time in `board:join` and then cached on the client struct, keeping
the high-frequency move handlers cheap:

- **Access gate.** Public boards: open to anyone. Restricted (unpublished) boards: only the
  authenticated owner may join — everyone else gets _"This board is not published."_
- **Privilege gate.** `CanManageWidgets` checks Casbin policies via the DB and stores the result as
  `client.canMove`; the `widget:move` / `widget:move:end` / `widget:place` handlers early-return
  unless it's `true`.

```go
// service/realtime/gateway.go — resolved once at join, checked on every move
client.canMove = authUserID != "" && g.socketAuth.CanManageWidgets(authUserID, boardID)
…
if !data.boardId || !client.canMove { return }  // end users are read-only on the canvas
```

---

## 8. Plan-Aware RBAC — Casbin Policies + Quota Snapshots

**The problem.** Authorization here is two-dimensional: a _capability_ question ("can this user
create boards?") **and** a _quota_ question ("has this tenant used up their plan's 2 free boards?").
And sub-users inherit their parent tenant's plan budget. A flat permission list can't express that.

**The solution — a layered permission resolution** expressed through Casbin:

### The Casbin model

```
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[matchers]
m = g(r.sub, p.sub) && (p.obj == "*" || keyMatch2(r.obj, p.obj)) && (p.act == "*" || regexMatch(r.act, p.act))
```

Key characteristics:
- **RBAC with role hierarchy:** `g = _, _` supports user-to-role grouping
- **keyMatch2 matcher:** supports path patterns like `/api/v1/boards/:id`
- **Wildcard support:** `p.obj == "*"` for super-admin
- **Regex matcher on methods:** `regexMatch(r.act, p.act)` allows `PUT|PATCH` patterns

### Enforcement middleware

```go
// service/auth/middleware/casbin.go
func CasbinMiddleware(e auth.Enforcer, logger *slog.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Extract tenantID from JWT claims
            rctx := chi.RouteContext(r.Context())
            pattern := rctx.RoutePattern()
            allowed, err := e.Enforce(tenantID, pattern, method)
            // ... handle denial ...
        })
    }
}
```

### Policy seed

Policies are persisted in PostgreSQL via `casbin-pgx-adapter`. A seed script populates ~22
permissions (`PermissionCatalog`) and role-based endpoint policies:
- Super Admin: `p(roleID, "*", "*")` — wildcard
- Tenant role: `p(tenantRoleID, "/api/v1/boards", "POST")` — endpoint-specific
- User-to-role bindings: `g(userID, roleID)`

### Quota enforcement

A `LimitGuard` middleware runs _after_ Casbin on `CREATE` routes. It reads from `limit_usages` and
`package_permission_limits` tables, decrements remaining quota, and blocks with HTTP 429 when
exhausted. Sub-user quotas fall back to the parent tenant's snapshot (`fallbackToParentQuota`).

```
Request → JWTMiddleware → CasbinMiddleware (can they?) → LimitGuard (quota left? decrement) → handler
```

---

## 9. Failure Tolerance & Graceful Degradation

The realtime stack is designed so infrastructure hiccups degrade features rather than crash the app:

| Failure                                   | Behavior                                                                                  | Where                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- |
| Redis down at boot                        | Lazy connect + retry — app boots, first command reconnects                                | `module/main.module.go`               |
| Redis expiry subscriber not yet connected | `Subscribe().Catch()` — bootstrap never blocks                                            | `service/realtime/service.go`         |
| RabbitMQ unreachable                      | Broadcasts still fire; only durable position persistence is skipped ("canvas stays live")  | `service/realtime/rabbitmq.go`        |
| Poison position message                   | Consumer `nack(false, false)` — one bad write dropped, not looped                         | `service/realtime/consumer.go`        |
| Stale Redis position vs DB                | Reads prefer the live Redis position, reconciled by the consumer's eventual write         | `service/realtime/service.go:GetBoardWidgets` |

Error handling throughout uses Go's idiomatic `(data, error)` return tuples, keeping the failure
path explicit and uniform.

---

## 10. Scaling the WebSocket Tier — Redis Pub/Sub Backplane

**The problem.** A single Go process holds Hub rooms in memory. Run two API instances behind
a load balancer and an `EmitToRoom` on instance A never reaches the clients connected
to instance B — broadcasts silently fragment.

**The solution — a Redis Pub/Sub backplane.** The `Hub` struct publishes its room emits to a
Redis channel `lootboard:rt` and every instance relays them to its locally-connected sockets, so a
broadcast reaches the whole cluster regardless of which node a client landed on.

```go
// service/realtime/hub.go — StartBackplane()
func (h *Hub) StartBackplane(ctx context.Context) {
    pubsub := h.rdb.Subscribe(ctx, "lootboard:rt")
    h.backplane = true
    go func() {
        ch := pubsub.Channel()
        for msg := range ch {
            var rm roomMessage
            json.Unmarshal([]byte(msg.Payload), &rm)
            if rm.InstanceID == h.instanceID { continue }
            h.deliverLocal(rm.Room, marshalEnvelope(rm.Event, json.RawMessage(rm.Payload)))
        }
    }()
}
```

```go
// hub.go — publish() sends to Redis for cross-instance delivery
func (h *Hub) publish(room, event string, payload any) {
    if h.rdb == nil || !h.backplane { return }
    msg := roomMessage{InstanceID: h.instanceID, Room: room, Event: event, Payload: raw}
    h.rdb.Publish(context.Background(), "lootboard:rt", string(b))
}
```

**Verified across two live instances.** Running the API on two ports against the same
Redis, a `widget:lock:soft:init` emitted on instance 1 was received by a client connected to
instance 2 — proving cross-node propagation through the backplane.

The design made this a clean drop-in:

- Redis is **already the shared coordination store** — locks, presence, viewports, and write-behind
  positions all live there, so no new dependency is introduced.
- All cross-client communication already goes through **named rooms** (board-wide + per-zone), which
  is exactly the unit the Hub distributes; nothing broadcasts to raw socket ids.
- Lock atomicity (`SETNX`) and expiry events are **already centralized in Redis**, so they remain
  correct across N instances with zero change.

**Graceful degradation.** If Redis is unreachable at boot, `StartBackplane` logs a warning and
falls back to in-memory Hub delivery (correct for a single instance). Once connected, the backplane
self-heals across runtime Redis blips.

---

## 11. Module Map & Data Stores

```
services/api/
├── cmd/
│   ├── server/main.go        # API server entrypoint (chi + graceful shutdown)
│   ├── migrate/main.go       # Goose migration runner
│   └── seed/main.go          # Database seeder
├── sqlc.yaml                 # SQLC code generation config
└── internal/
    ├── adapters/             # Infrastructure adapters (hexagonal: ports → adapters)
    │   ├── casbin/           # Casbin enforcer adapter (pgx-backed)
    │   └── postgresql/       # DB pool, migrations, repos, SQLC output, UoW
    ├── config/               # Env loading, Casbin model.conf (embedded)
    ├── mail/                 # SMTP mailer + templ templates
    ├── module/               # DI root: main.module.go + test.module.go
    ├── service/              # Domain services (one sub-package per domain)
    │   ├── auth/             # Register, login, JWT, password reset, RBAC middleware
    │   ├── boards/           # Board CRUD
    │   ├── inventory/        # Widget CRUD, CSV import
    │   ├── order/            # Idempotent checkout + lock verification
    │   ├── realtime/         # ★ WebSocket engine (hub, gateway, service, zone, rabbitmq, consumer)
    │   ├── role/             # Role CRUD, Casbin policy management
    │   ├── user/             # User CRUD
    │   ├── package/          # Subscription package CRUD
    │   └── subscription/     # Subscription management
    └── util/                 # JSON helpers
```

### Which store owns what — and why

| Store                    | Owns                                                                                              | Why this store                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **PostgreSQL** (SQLC)    | Boards, widgets, orders, users, roles, plan snapshots — the durable system of record              | Relational integrity, transactions, type-safe queries via SQLC codegen                         |
| **Redis**                | Soft/hard locks, `hardlocks`/`paid` sets, presence hash, write-behind widget positions, viewports | Single-threaded atomicity (`SETNX`), free TTL expiry, keyspace events, shared across instances  |
| **RabbitMQ**             | The `widget.position` durable queue (debounced persistence)                                       | Decouples 60 fps write storms from the DB; durable + back-pressured                             |

### Inbound WebSocket events (the backend's real-time API)

| Event                       | Handler                | Purpose                                                              |
| --------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `board:join:private` / `public` | `onJoin`          | Auth + access gate, join zones, return widgets/peers/locks           |
| `viewport:update`           | `onViewportUpdate`     | Diff & re-subscribe zone rooms on pan/zoom                           |
| `cursor:move:send`          | `onCursorMove`         | Relay cursor to the one zone it's in                                 |
| `widget:lock:soft:init`     | `onSoftLock`           | Atomic 60 s soft lock (+ bot guard)                                  |
| `widget:lock:hard:init`     | `onHardLock`           | Promote the user's soft locks to 5 min hard locks (checkout)         |
| `widget:move` / `move:end`  | `onWidgetMove` / `End` | Write-behind position + debounced/immediate persist + zone broadcast |
| `widget:place`              | `onWidgetPlace`        | Stamp first coordinates onto a sidebar item, broadcast to peers      |

---

## Appendix: Hexagonal Architecture & Testing

### Ports and Adapters

The codebase follows **hexagonal architecture** (ports & adapters):

- **Ports** are Go interfaces defined in each domain's `interfaces.go`:
  - `service/auth/interfaces.go` — `AuthRepo`, `AuthService`, `Enforcer`, `UnitOfWork`
  - `service/realtime/interfaces.go` — `RealtimeRepo`, `Emitter`, `Service`
  - `service/order/interfaces.go` — `OrderRepo`, `RealtimeGateway`, `OrderService`

- **Adapters** implement those interfaces in `adapters/`:
  - `adapters/postgresql/repo/` — SQLC-backed repository implementations
  - `adapters/postgresql/uow/` — Unit of Work (pgx transactions)
  - `adapters/casbin/` — Casbin enforcer wrapper

### Dependency Injection

Manual constructor injection in `module/main.module.go` — no DI framework:

```go
func NewApp(logger, cfg, pool, enforcer) *App {
    queries := sqlc.New(pool)
    authRepo := repo.NewAuthRepository(pool)
    uow := uow.NewAuthUoW(pool)
    authService := auth.NewService(authRepo, uow, logger, cfg, mailSvc, enforcer)
    authHandler := auth.NewHandler(authService)
    // ... wire all domains ...
}
```

Compile-time interface checks at the bottom of `interfaces.go`:
```go
var _ Service = (*service)(nil)
var _ Emitter = (*Hub)(nil)
```

### Testing with In-Memory Fakes

Hexagonal architecture enables testing without external infrastructure:

- **`module/test.module.go`** — full test composition root with fakes
- **`service/auth/mock/repo.go`** — `FakeRepo` (in-memory slices + maps, thread-safe)
- **`service/auth/mock/uow.go`** — `MemUoW` (executes callbacks directly, no transaction)
- **`adapters/casbin/casbin.mock.go`** — `InitFakeCasbinEnforcer()` with in-memory policies

```go
// E2E test pattern
testModule := module.NewTestModule()
r := app.NewServer(router, testModule).Init()
ts := httptest.NewServer(r)
// ... make HTTP requests against ts.URL ...
testModule.AuthRepo.Reset()  // cleanup between tests
```

Tests run **without** Postgres, Redis, or RabbitMQ — the fakes satisfy all port interfaces,
making the test suite fast and deterministic.

---

_Backends like this are interesting because the hard parts aren't the CRUD — they're the
concurrency model (atomic Redis locks), the impedance match between a 60 fps event stream and a
relational database (write-behind cache + debounced queue), and making "expire in 60 seconds and
tell everyone" a first-class, restart-safe primitive (keyspace events). Each was solved with the
simplest mechanism that is actually correct under concurrency._
