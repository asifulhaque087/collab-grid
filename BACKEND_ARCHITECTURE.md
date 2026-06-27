# CollabGrid — Backend Architecture & Engineering Deep-Dive

> How the NestJS backend solves the hard problems behind a real-time collaborative commerce
> canvas: concurrent ownership without race conditions, double-payment prevention, surviving
> 60 fps WebSocket write storms without melting the database, viewport-scoped broadcasting, and
> a plan-aware RBAC system.

This document is **backend-only** and **problem-first**. Each section names a classic distributed-
systems / web-engineering problem, then walks the exact mechanism in this codebase that solves it,
with file references. The most complex and interesting problems are at the top.

**Stack:** NestJS · PostgreSQL + Drizzle ORM · Redis (ioredis) · RabbitMQ (amqplib) · socket.io.

---

## Table of Contents

1. [Race Conditions on Shared Inventory — Atomic Distributed Locks](#1-race-conditions-on-shared-inventory--atomic-distributed-locks)
2. [60 fps WebSocket Write Storms — Write-Behind Cache + Debounced Persistence](#2-60-fps-websocket-write-storms--write-behind-cache--debounced-persistence)
3. [Zero Double-Payment — Idempotency + Server-Authoritative Checkout](#3-zero-double-payment--idempotency--server-authoritative-checkout)
4. [Auto-Expiring Reservations — Redis Keyspace Notifications as an Event Bus](#4-auto-expiring-reservations--redis-keyspace-notifications-as-an-event-bus)
5. [Viewport Rate-Limiting — Spatial Zone Sharding of the Broadcast Fan-out](#5-viewport-rate-limiting--spatial-zone-sharding-of-the-broadcast-fan-out)
6. [Bot / Abuse Detection — Mouse-Teleportation Guard](#6-bot--abuse-detection--mouse-teleportation-guard)
7. [WebSocket Authentication & Privilege Gating](#7-websocket-authentication--privilege-gating)
8. [Plan-Aware RBAC — CASL Abilities + Quota Snapshots](#8-plan-aware-rbac--casl-abilities--quota-snapshots)
9. [Failure Tolerance & Graceful Degradation](#9-failure-tolerance--graceful-degradation)
10. [Scaling the WebSocket Tier — Redis Pub/Sub Adapter](#10-scaling-the-websocket-tier--redis-pubsub-adapter)
11. [Module Map & Data Stores](#11-module-map--data-stores)

---

## 1. Race Conditions on Shared Inventory — Atomic Distributed Locks

**The problem.** Many anonymous shoppers look at the same canvas. Two of them click the same
sneaker at the same millisecond. A naive "read row → check available → mark taken" sequence has a
TOCTOU race: both reads see "available," both write "taken," both proceed to checkout. SQL row
locks (`SELECT … FOR UPDATE`) serialize this but buckle under flash-sale burst velocity and hold
DB connections hostage for the entire human "thinking" time of a checkout.

**The solution — a single atomic Redis operation.** Ownership is modeled as a lock *key* in Redis,
acquired with `SET key value NX PX ttl`. Redis is single-threaded, so `NX` ("set only if Not
eXists") is atomically all-or-nothing: exactly one of the two concurrent clients gets `OK`, the
other gets `null`. No transaction, no row lock, no DB round-trip.

```ts
// realtime.service.ts — acquireSoftLock()
const res = await this.redis.set(key, value, 'PX', SOFT_LOCK_MS, 'NX');
if (res === 'OK') return { ok: true, lock: { …, ttl: SOFT_LOCK_MS } };
const holder = await this.getLock(boardId, widgetId);   // tell the loser who won
return { ok: false, reason: 'taken', holder: holder?.userId };
```

The lock carries its own **TTL** (`PX 60000`), so a shopper who locks an item and then closes
their laptop cannot strand inventory forever — Redis evicts the key after 60 seconds and the item
frees itself (see §4). The lock value is JSON `{ userId, kind }` so the server always knows *who*
holds it and whether it is a soft or hard lock.

### The three-state lock lifecycle

```
  OPEN ──click──► SOFT LOCK (amber, 60s) ──checkout──► HARD LOCK (red, 5min) ──pay──► COMMITTED
   ▲                    │                                    │
   └──── TTL expiry ────┴──────────── TTL expiry ────────────┘  (auto-release, item returns)
```

| Transition | Mechanism | File |
| --- | --- | --- |
| Acquire soft lock | `SET NX PX 60000` | `realtime.service.ts:acquireSoftLock` |
| Promote to hard lock | Re-`SET` same key `PX 300000`, add widget to a per-board `hardlocks:<board>` set | `realtime.service.ts:promoteToHardLocks` |
| Verify ownership at checkout | `getLock` → compare `userId` | `realtime.service.ts:userHoldsLock` |
| Release / expire | Key TTL fires keyspace event | §4 |

**Why a per-board `hardlocks` set?** When a key expires, the keyspace event only tells us *which
key* died — not whether it was a soft or hard lock (both use the same `lock:<board>:<widget>` key).
`resolveExpiredLock` does an atomic `SREM` on the `hardlocks` set: if the widget was in it, it was a
hard lock; the `SREM` both *answers the question* and *removes the membership* in one race-free op.

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
 │  2. rabbit.publishDebounced(...)          (coalesce 400ms)        │  ← at most ~2-3 writes/sec
 │  3. broadcast widget:moved to overlapping zones                   │  ← peers see it instantly
 └──────────────────────────────────────────────────────────────────┘
        │ (400ms after the last frame)
        ▼
 RabbitMQ  widget.position queue (durable)
        ▼
 WidgetPersistenceConsumer → single UPDATE smart_widget …  ← Postgres sees ~1 write per drag
```

Three layers, each doing exactly one job:

1. **Redis write-behind cache** (`saveWidgetPosition`, TTL 1h). Every frame writes the live
   coordinates to Redis. This is the read-recovery source: when anyone joins or refreshes,
   `getBoardWidgets` prefers the Redis position over the (possibly stale) DB `posX/posY`, so the
   canvas is always consistent even though the DB write hasn't landed yet.

   ```ts
   // getBoardWidgets() — Redis is the source of truth for in-flight positions
   const live = await this.getWidgetPosition(boardId, w.id);
   x: live?.x ?? Number(w.posX),
   ```

2. **RabbitMQ debounced persistence.** `publishDebounced` keeps a per-widget timer; a burst of 60
   moves collapses into **one** queued message 400 ms after the drag settles. `widget:move:end`
   calls `publish`, which flushes the pending timer and persists immediately — so the final
   resting position is never lost to debounce.

   ```ts
   // rabbitmq.service.ts — per-widget debounce map
   publishDebounced(msg, delayMs = 400) {
     clearTimeout(this.debounce.get(msg.widgetId));
     this.debounce.set(msg.widgetId, setTimeout(() => this.send(msg), delayMs));
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

**The solution — four stacked guarantees** in `order.service.ts`:

1. **Idempotency key (pre-check).** Every checkout carries a client-generated UUID stored on a
   **unique** `order.idempotencyKey` column. A repeated submit finds the existing row and returns
   the *original* order — no second insert, no second charge:
   ```ts
   const [existing] = await this.db.select(...).where(eq(orderTable.idempotencyKey, dto.idempotencyKey));
   if (existing) return { orderId: existing.id, duplicate: true };
   ```

2. **Idempotency key (race fallback).** Two requests can pass the pre-check simultaneously. The DB
   `UNIQUE` constraint is the real arbiter: the second `INSERT` throws a unique violation, which is
   caught and converted back into "return the original order" — so even a true concurrent
   double-submit yields one order.

3. **Lock verification.** Before charging, the server confirms the buyer *actually holds a live
   lock* on every widget (`realtime.userHoldsLock`). You cannot buy what you didn't reserve, and a
   lapsed 5-minute hard-lock window blocks the purchase.

4. **Server-authoritative total.** The amount is recomputed from the database rows, never read from
   the client payload:
   ```ts
   const total = widgets.reduce((sum, w) => sum + Number(w.price ?? 0), 0);
   ```

The order insert + line items run in a single Drizzle **transaction**, and only after the
transaction commits does `gateway.completePurchase()` remove the sold widgets, clear their Redis
locks, and broadcast `widget:purchased` to every viewer so the item leaves all canvases at once.

---

## 4. Auto-Expiring Reservations — Redis Keyspace Notifications as an Event Bus

**The problem.** A soft lock must auto-release after 60 s and a hard lock after 5 min — *and every
connected client's canvas must update the instant it does*. Polling Redis for expired keys is
wasteful and laggy; a per-lock `setTimeout` in Node is lost on restart and doesn't survive multiple
server instances.

**The solution — let Redis itself fire the event.** Redis is started with
`--notify-keyspace-events Ex` (see `docker-compose.yml`), which publishes a message on
`__keyevent@*__:expired` the moment any key with a TTL dies. A **dedicated** Redis subscriber
connection (ioredis goes into subscriber mode and can't run normal commands, hence the two-client
split in `redis.module.ts`) listens and routes:

```ts
// realtime.gateway.ts — afterInit()
this.subscriber.psubscribe('__keyevent@*__:expired');
this.subscriber.on('pmessage', (_p, _c, expiredKey) => {
  const parsed = this.realtime.parseLockKey(expiredKey);   // lock:<board>:<widget>
  if (parsed) this.handleLockExpiry(parsed.boardId, parsed.widgetId);
});
```

`resolveExpiredLock` then classifies the expiry and the gateway broadcasts the right event:

| Outcome | Meaning | Broadcast |
| --- | --- | --- |
| `soft` | A 60 s soft lock lapsed | `widget:lock:soft:release` (amber → open) |
| `hard-released` | A 5 min hard lock lapsed unpaid | `widget:lock:hard:release` (red → open) |
| `hard-purchased` | Hard lock expired but a `paid:` flag was set | delete widget + `widget:purchased` |

This turns Redis TTL into a **reliable, server-driven event source** — no polling, no in-process
timers, and it works identically whether the lock expires in 1 second or 5 minutes.

---

## 5. Viewport Rate-Limiting — Spatial Zone Sharding of the Broadcast Fan-out

**The problem.** "Broadcast every cursor move and widget move to everyone on the board" is O(users²)
bandwidth. With hundreds of shoppers on a large canvas, a user panned to the top-left corner would
still receive a firehose of updates for widgets they cannot see — wasted server egress and wasted
client CPU.

**The solution — partition space, subscribe to what you can see.** `ZoneService` divides the fixed
10,000 × 10,000 world into a **10 × 10 grid of 1,000 px zones**, mapped onto socket.io rooms
(`board:<id>:zone:<x>_<y>`). Each client subscribes only to the zones its current viewport overlaps;
the server fans an event out only to those zones.

```ts
// zone.service.ts — a viewport (or widget bbox) → the set of zones it overlaps
calculateOverlappingZones(viewport): string[]   // rooms to join
calculateWidgetOverlappingZones(x, y, w, h)      // rooms to broadcast a widget into
```

**Dynamic re-subscription on pan.** When a client sends `viewport:update`, the gateway diffs the new
zone set against the old one and only `join`s/`leave`s the delta — it doesn't churn the whole
subscription:

```ts
// realtime.gateway.ts — onViewportUpdate()
for (const z of data.zones) if (!next.has(z)) await client.leave(room(z));  // left these
for (const z of next) if (!data.zones.has(z)) await client.join(room(z));   // entered these
data.zones = next;
```

**Two broadcast scopes** are deliberately distinguished:

- **Zone rooms** — high-frequency, spatially-local events (`cursor:move`, `widget:moved`,
  `widget:placed`). A widget move is published into exactly the zones its bounding box overlaps, so
  only viewers looking there are billed the bandwidth.
- **Board-wide room** (`board:<id>`) — events everyone must see regardless of where they're looking
  (presence join/leave, lock state changes). Lock color must be globally consistent, so it ignores
  zones.

This keeps per-event fan-out proportional to *viewers of the affected region*, not total users —
the core "stream only what's in the viewport" non-functional requirement.

---

## 6. Bot / Abuse Detection — Mouse-Teleportation Guard

**The problem.** A script can fire lock requests faster than any human hand, sniping inventory or
DoS-ing the lock system.

**The solution.** `acquireSoftLock` keeps the timestamp of each user's last lock attempt in an
in-memory map and rejects anything faster than a human could physically click
(`MIN_LOCK_INTERVAL_MS = 120`). The gateway surfaces this distinctly from a normal "already locked"
denial so the UI can say "Too many rapid actions — slow down."

```ts
// realtime.service.ts
const last = this.lastLockAttempt.get(userId) ?? 0;
this.lastLockAttempt.set(userId, now);
if (now - last < MIN_LOCK_INTERVAL_MS) return { ok: false, reason: 'bot' };
```

*(Per-instance heuristic today; in a multi-node deployment this would move to a Redis counter so the
rate window is shared across nodes — see §10.)*

---

## 7. WebSocket Authentication & Privilege Gating

**The problem.** REST routes are protected by guards, but a WebSocket connection is long-lived and
anonymous by default. End users join boards with no account at all, yet only the tenant (or a
permitted sub-user) may *move* or *place* widgets — and unpublished boards must not be joinable by
strangers.

**The solution — authenticate once at join, cache the verdict.** `SocketAuthService.authenticate`
reads the **same `accessToken` httpOnly cookie** from the socket handshake and verifies the JWT, so
the WebSocket trust model is identical to the REST one (no separate token channel). Anonymous end
users simply resolve to `null`.

Two gates are resolved a single time in `board:join` and then cached on the socket, keeping the
high-frequency move handlers cheap:

- **Access gate.** Public boards: open to anyone. Restricted (unpublished) boards: only the
  authenticated owner (`ownsBoard`, tenant-scoped via `parentId`) may join — everyone else gets
  *"This board is not published."*
- **Privilege gate.** `canManageWidgets` builds a CASL ability from the user's role grants + tenant
  plan snapshot and checks `update:SmartWidget`. The result is stored as `socket.data.canMove`; the
  `widget:move` / `widget:move:end` / `widget:place` handlers early-return unless it's true.

```ts
// realtime.gateway.ts — resolved once at join, checked on every move
data.canMove = authUserId ? await this.socketAuth.canManageWidgets(authUserId, board.id) : false;
…
if (!data.boardId || !data.canMove) return;   // end users are read-only on the canvas
```

---

## 8. Plan-Aware RBAC — CASL Abilities + Quota Snapshots

**The problem.** Authorization here is two-dimensional: a *capability* question ("can this user
create boards?") **and** a *quota* question ("has this tenant used up their plan's 2 free boards?").
And sub-users inherit their parent tenant's plan budget. A flat permission list can't express that.

**The solution — a layered permission resolution** in `permissions.guard.ts`, expressed as CASL
abilities so backend and frontend share one model:

1. **Roles → grants.** A user's roles are classified (`classifyRoles`) into admin roles (super-admin
   / admin-created) and tenant roles. Admin grants come straight from `group_permission`.
2. **Plan snapshot → grants + exhaustion.** Tenant capability + quota lives in
   `user_plan_snapshot` rows (`action`, `subject`, `granted`, `remaining`). A row resolves to:
   - **granted** if unlimited (`granted`/`remaining` is `null`/`-1`) or `remaining > 0`;
   - **overflow-granted** if `remaining === 0` but the plan is still active (allowed now, but
     flagged for billing);
   - **exhausted** (hard block) if `remaining === 0` *and* the plan has expired.
3. **Sub-user inheritance.** A tenant sub-user's quota is read from the **parent** tenant's snapshot
   (`fallbackToParentQuota`), so a team shares one plan budget.

`buildAbility(grants)` produces a CASL `AppAbility`; the guard then checks each route's required
tuple and throws a *quota* message vs an *authorization* message depending on whether the permission
was merely missing or specifically exhausted.

**Quota decrement is a separate guard.** `QuotaGuard` runs *after* `PermissionsGuard` and only on
`CREATE` routes. It decrements the matching `remaining`, and once that hits 0 it increments an
`extra` overage counter instead — so plan limits are enforced *and* overages are tracked for
billing, all at the data layer.

```
Request → AccessTokenGuard → PermissionsGuard (can they? quota left?) → QuotaGuard (decrement) → handler
```

A nightly `@nestjs/schedule` cron (subscription module) downgrades expired tenants to the free plan
and resets their snapshot quotas, which is what flips active overflow into the hard-blocked
`exhausted` state above.

---

## 9. Failure Tolerance & Graceful Degradation

The realtime stack is designed so infrastructure hiccups degrade features rather than crash the app:

| Failure | Behavior | Where |
| --- | --- | --- |
| Redis down at boot | `lazyConnect` + `retryStrategy` — app boots, first command reconnects | `redis.module.ts` |
| Redis expiry subscriber not yet connected | `psubscribe(...).catch(() => undefined)` — bootstrap never blocks | `realtime.gateway.ts` |
| RabbitMQ unreachable | Broadcasts still fire; only durable position persistence is skipped ("canvas stays live") | `rabbitmq.service.ts` |
| Poison position message | Consumer `nack`s without requeue — one bad write dropped, not looped | `rabbitmq.service.ts` |
| Stale Redis position vs DB | Reads prefer the live Redis position, reconciled by the consumer's eventual write | `realtime.service.ts:getBoardWidgets` |

Error handling throughout uses the shared `tryit()` helper (`packages/common`) returning
`[data, error]` tuples instead of `try/catch`, keeping the failure path explicit and uniform.

---

## 10. Scaling the WebSocket Tier — Redis Pub/Sub Adapter

**The problem.** A single Node process holds socket.io rooms in memory. Run two API instances behind
a load balancer and a `server.to(room).emit(...)` on instance A never reaches the clients connected
to instance B — broadcasts silently fragment.

**The solution — a Redis Pub/Sub backplane.** socket.io's **Redis adapter**
(`@socket.io/redis-adapter`) is wired in via a custom `RedisIoAdapter` (`realtime/redis-io.adapter.ts`,
installed in `main.ts` with `app.useWebSocketAdapter`). Each instance publishes its room emits to a
Redis channel and every instance relays them to its locally-connected sockets, so a broadcast reaches
the whole cluster regardless of which node a client landed on.

```ts
// main.ts — bootstrap
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis();   // builds the pub/sub client pair
app.useWebSocketAdapter(redisIoAdapter);
```

```ts
// redis-io.adapter.ts — attach the Redis adapter to the socket.io server
createIOServer(port, options) {
  const server = super.createIOServer(port, options);
  if (this.adapterConstructor) server.adapter(this.adapterConstructor);
  return server;
}
```

**Verified across two live instances.** Running the API on ports 3001 and 3002 against the same
Redis, a `widget:lock:soft:init` emitted on instance 1 was received by a client connected to
instance 2 — proving cross-node propagation through the backplane rather than just in-process
delivery.

The design made this a clean drop-in:

- Redis is **already the shared coordination store** — locks, presence, viewports, and write-behind
  positions all live there, so no new dependency is introduced.
- All cross-client communication already goes through **named rooms** (board-wide + per-zone), which
  is exactly the unit the Redis adapter distributes; nothing broadcasts to raw socket ids.
- Lock atomicity (`SET NX`) and expiry events are **already centralized in Redis**, so they remain
  correct across N instances with zero change — the hard part of multi-node correctness was done.

**Graceful degradation.** The adapter clients use `lazyConnect`, and the *initial* connect is raced
against a 3 s timeout: if `REDIS_URL` is unset or Redis is unreachable at boot, the adapter logs a
warning and falls back to socket.io's in-memory adapter (correct for a single instance) instead of
hanging bootstrap. The `retryStrategy` itself stays infinite, so once connected the backplane
self-heals across runtime Redis blips.

The remaining per-instance state to centralize for full horizontal scale is the bot-guard timestamp
map (§6) and the RabbitMQ debounce timers — both would move to Redis keys so the rate window and the
coalescing are cluster-wide. Presence is already in a shared Redis hash, so it's multi-node-correct
as-is.

---

## 11. Module Map & Data Stores

```
apps/api/src/
├── realtime/                         ★ the engine
│   ├── realtime.gateway.ts           socket.io /canvas namespace — all @SubscribeMessage handlers,
│   │                                 keyspace-expiry subscription, zone broadcast orchestration
│   ├── realtime.service.ts           lock state machine, write-behind positions, presence, identity
│   ├── socket-auth.service.ts        handshake-cookie JWT + board ownership + canManageWidgets (CASL)
│   ├── zone.service.ts               10×10 spatial grid → socket.io room mapping
│   ├── rabbitmq.service.ts           debounced/immediate publisher (per-widget timers)
│   ├── widget-persistence.consumer.ts  drains the durable queue → single Postgres UPDATE
│   └── redis.module.ts               two ioredis clients (command + subscriber), lazy + retrying
├── orders/        idempotent, server-authoritative checkout + lock verification + PDF invoice
├── auth/          JWT (httpOnly cookies), CASL permission catalog, guards, strategies
│   └── guards/    AccessTokenGuard · PermissionsGuard (capability+quota) · QuotaGuard (decrement)
├── boards/ inventory/ plans/ roles/ subscription/   tenant-scoped REST modules
├── schemas/       Drizzle tables (system of record) — migrations committed under apps/api/drizzle
└── drizzle/       db module, prod migrate runner, idempotent seed
```

### Which store owns what — and why

| Store | Owns | Why this store |
| --- | --- | --- |
| **PostgreSQL** (Drizzle) | Boards, widgets, orders, users, roles, plan snapshots — the durable system of record | Relational integrity, transactions, type-safe migrations |
| **Redis** | Soft/hard locks, `hardlocks`/`paid` sets, presence hash, write-behind widget positions, viewports | Single-threaded atomicity (`SET NX`), free TTL expiry, keyspace events, shared across instances |
| **RabbitMQ** | The `widget.position` durable queue (debounced persistence) | Decouples 60 fps write storms from the DB; durable + back-pressured |

### Inbound socket events (the backend's WebSocket API)

| Event | Handler | Purpose |
| --- | --- | --- |
| `board:join` | `onJoin` | Auth + access gate, join zones, return widgets/peers/locks |
| `viewport:update` | `onViewportUpdate` | Diff & re-subscribe zone rooms on pan/zoom |
| `cursor:move:send` | `onCursorMove` | Relay cursor to the one zone it's in |
| `widget:lock:soft:init` | `onSoftLock` | Atomic 60 s soft lock (+ bot guard) |
| `widget:lock:hard:init` | `onHardLock` | Promote the user's soft locks to 5 min hard locks (checkout) |
| `widget:move` / `:move:end` | `onWidgetMove` / `End` | Write-behind position + debounced/immediate persist + zone broadcast |
| `widget:place` | `onWidgetPlace` | Stamp first coordinates onto a sidebar item, broadcast to peers |

---

*Backends like this are interesting because the hard parts aren't the CRUD — they're the
concurrency model (atomic Redis locks), the impedance match between a 60 fps event stream and a
relational database (write-behind cache + debounced queue), and making "expire in 60 seconds and
tell everyone" a first-class, restart-safe primitive (keyspace events). Each was solved with the
simplest mechanism that is actually correct under concurrency.*
