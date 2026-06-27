# CollabGrid — Architecture

> A unified, ultra-fast collaborative workspace platform that fuses **real-time visual canvas
> management** with **high-throughput transactional inventory booking**.
>
> CollabGrid lets a tenant lay out interactive "smart widgets" (inventory items) on a
> hardware-accelerated canvas, publish that canvas as a public link, and let anonymous
> shoppers lock and buy items live — without two users ever double-spending the same item.

This document describes the system's architecture: the moving parts, why they exist, and how
data flows through them. It is intended as a technical reference for engineers (and reviewers)
evaluating the design.

---

## Table of Contents

1. [System at a Glance](#1-system-at-a-glance)
2. [Technology Choices & Rationale](#2-technology-choices--rationale)
3. [Monorepo Layout](#3-monorepo-layout)
4. [Backend Architecture (NestJS)](#4-backend-architecture-nestjs)
5. [Real-Time Engine](#5-real-time-engine)
6. [The Lock Lifecycle (Core Domain)](#6-the-lock-lifecycle-core-domain)
7. [Checkout & Zero-Double-Spend Pipeline](#7-checkout--zero-double-spend-pipeline)
8. [Authentication, RBAC & Quota Enforcement](#8-authentication-rbac--quota-enforcement)
9. [Frontend Architecture (Next.js)](#9-frontend-architecture-nextjs)
10. [Data Model](#10-data-model)
11. [Infrastructure & Local Development](#11-infrastructure--local-development)
12. [Key Engineering Decisions](#12-key-engineering-decisions)

---

## 1. System at a Glance

CollabGrid is a **Turborepo monorepo** with two deployable applications and one shared package,
backed by three stateful services (PostgreSQL, Redis, RabbitMQ).

```
                          ┌──────────────────────────────────────────────┐
                          │                  Browser                      │
                          │  Next.js 16 (React 19) — SSR pages +          │
                          │  HTML5 Canvas 2D renderer + socket.io-client  │
                          └───────────────┬───────────────┬──────────────┘
                                  HTTP (REST,             WebSocket
                              httpOnly cookies)          (/canvas ns)
                                          │               │
                          ┌───────────────▼───────────────▼──────────────┐
                          │                NestJS API (apps/api)          │
                          │  ┌─────────────┐  ┌─────────────────────────┐ │
                          │  │ REST modules │  │   Realtime Gateway      │ │
                          │  │ auth boards  │  │  socket.io + zone fanout│ │
                          │  │ inventory    │  │  lock state machine     │ │
                          │  │ orders plans │  └───────────┬─────────────┘ │
                          │  │ roles subs   │              │               │
                          │  └──────┬───────┘              │               │
                          └─────────┼──────────────────────┼───────────────┘
                                    │                       │
              ┌─────────────────────┼───────────┬───────────┼──────────────┐
              ▼                     ▼           ▼            ▼              ▼
        ┌──────────┐         ┌───────────┐ ┌──────────┐ ┌──────────┐  ┌─────────┐
        │PostgreSQL│         │   Redis   │ │ RabbitMQ │ │  Redis   │  │RabbitMQ │
        │ (Drizzle)│         │ atomic    │ │ position │ │ keyspace │  │checkout │
        │ system   │         │ locks +   │ │ persist  │ │ expiry   │  │ queue   │
        │ of record│         │ presence  │ │ (debounce│ │ events   │  │         │
        └──────────┘         └───────────┘ │  writes) │ └──────────┘  └─────────┘
                                           └──────────┘
```

**The thesis:** standard REST + a single SQL database cannot simultaneously deliver
high-frequency spatial sync *and* burst-safe transactional booking. CollabGrid splits the
problem across purpose-built stores:

| Concern | Store | Why |
| --- | --- | --- |
| Source of truth (boards, widgets, orders) | PostgreSQL + Drizzle | Type-safe, relational, durable |
| Atomic ownership / soft & hard locks | Redis (`SET NX PX`) | Single-threaded atomicity, TTL auto-expiry |
| Lock-expiry reactions | Redis keyspace notifications | Server reacts the instant a lock dies |
| Debounced position writes & checkout | RabbitMQ | Decouples burst velocity from DB write rate |
| Viewport-filtered broadcast | Zone grid + socket.io rooms | Only stream what a user can actually see |

---

## 2. Technology Choices & Rationale

| Layer | Technology | Why it was chosen |
| --- | --- | --- |
| Monorepo orchestration | **Turborepo + pnpm** | Cached, parallel builds across `web`/`api`/`common`; one shared type/utility package |
| Frontend | **Next.js 16 (React 19)** | Server components for dashboards, SSR for the public board route, server actions for mutations |
| Backend | **NestJS** | Modular DI architecture; first-class WebSocket gateway support alongside REST |
| Database | **PostgreSQL + Drizzle ORM** | Type-safe schema-as-code, declarative SQL migrations committed to VCS |
| In-memory / locks | **Redis** | Atomic `SET NX PX` is the entire foundation of the lock model; keyspace expiry events drive auto-release |
| Message broker | **RabbitMQ** | Async checkout queue + debounced position persistence (absorbs write bursts) |
| Rendering | **HTML5 Canvas 2D** | Hardware-accelerated, high-framerate widget rendering under pan/zoom |
| Styling | **Tailwind CSS v4 + ShadCN UI** | CSS-first config (`@theme`), dark-mode-first design tokens |
| Forms & validation | **React Hook Form + Zod** | Shared validation for widget config and checkout |
| Realtime client | **socket.io-client** | Rooms, reconnection, heartbeat — matches the server gateway |
| State | **Zustand** | Lightweight client store for canvas + cart state |

---

## 3. Monorepo Layout

```
collab-grid/
├── apps/
│   ├── api/                 # NestJS backend  (port 3001)
│   │   └── src/
│   │       ├── auth/        # JWT auth, CASL permissions, guards, strategies
│   │       ├── boards/      # tenant-scoped board CRUD + public board route
│   │       ├── inventory/   # smart-widget CRUD + CSV bulk import
│   │       ├── orders/      # idempotent checkout + PDF invoice
│   │       ├── plans/       # plan CRUD (GroupTable type='plan')
│   │       ├── roles/       # custom role CRUD + permission catalog
│   │       ├── subscription/# plan purchase, quota top-up, expiry cron
│   │       ├── realtime/    # ⭐ socket gateway, zones, Redis & RabbitMQ
│   │       ├── mail/        # transactional email templates
│   │       ├── drizzle/     # db module, migrate runner, seed script
│   │       └── schemas/     # Drizzle table definitions (system of record)
│   └── web/                 # Next.js frontend (port 3000)
│       └── src/app/
│           ├── (auth)/      # sign-in / sign-up / reset (public auth group)
│           ├── dashboard/   # tenant workspace (shell group + canvas editor)
│           ├── b/[slug]/    # public anonymous shopper board route
│           ├── checkout/    # standalone checkout page
│           └── unauthorized/# RBAC redirect target
├── packages/
│   └── common/              # shared types + tryit() error helper
├── docker-compose.yml       # Redis + RabbitMQ for local dev
├── turbo.json               # task graph
└── context/                 # living project spec & feature log
```

The shared `packages/common` exposes `tryit()` — a `{ success, data, error }` wrapper used
project-wide in place of raw `try/catch`, so both apps handle errors with one consistent shape.

---

## 4. Backend Architecture (NestJS)

The API is organized as **feature modules**, each owning its controller, service, DTOs (Zod/
class-validator), and guard wiring. Cross-cutting concerns live in `auth/` and `realtime/`.

| Module | Responsibility |
| --- | --- |
| `auth` | Registration/login, httpOnly-cookie JWTs, Google OAuth, password reset, CASL permission catalog, guards |
| `boards` | Tenant-scoped board CRUD; `restricted` vs `public` access; unique-slug generation; public `GET /boards/public/:slug` |
| `inventory` | Smart-widget CRUD over `smart_widget`; CSV bulk import (one distinct DB record per row) |
| `plans` | Plan definitions stored as `group` rows with `type='plan'`; system-plan protection |
| `roles` | Custom tenant/super-admin roles with permission assignment |
| `subscription` | Plan purchase → quota snapshot top-up; nightly cron downgrades expired tenants to free |
| `orders` | Idempotent checkout, server-computed totals, PDF invoice streaming |
| `realtime` | The real-time engine (see next section) |

**Persistence pattern.** Every module writes through Drizzle to PostgreSQL — the durable system
of record. Migrations are generated (`pnpm --filter api db:generate`), committed to
`apps/api/drizzle/migrations`, and applied with a dedicated production runner (`migrate.ts`)
before the app boots. An idempotent `seed.ts` provisions the 20-permission catalog, the two
unremovable system roles (`super-admin`, `tenant`), free/pro plans, and seed users.

---

## 5. Real-Time Engine

The `realtime/` module is the heart of the product. It exposes a socket.io gateway on the
`/canvas` namespace and coordinates Redis, RabbitMQ, and the zone grid.

```
realtime/
├── realtime.gateway.ts          # socket.io entrypoint — all @SubscribeMessage handlers
├── realtime.service.ts          # lock state machine, broadcast orchestration
├── socket-auth.service.ts       # handshake-cookie JWT + board-ownership gating
├── zone.service.ts              # 10×10 spatial grid + bounding-box → zone mapping
├── redis.module.ts              # Redis client (locks, presence, keyspace expiry)
├── rabbitmq.service.ts          # publisher for debounced/async work
├── widget-persistence.consumer.ts  # drains move events → writes posX/posY to DB
└── realtime.types.ts            # shared event payload contracts
```

### Inbound socket events

| Event | Purpose |
| --- | --- |
| `board:join` | Join a board room; gated public-vs-restricted; returns presence + zones + widgets |
| `cursor:move:send` | Relay live cursor coordinates to peers |
| `viewport:update` | Report the user's current bounding box → subscribes them to overlapping zones |
| `widget:lock:soft:init` | Acquire a 60-second soft lock on a widget |
| `widget:lock:hard:init` | Promote soft locks → 5-minute hard locks at checkout |
| `widget:move` / `widget:move:end` | Drag a widget (debounced persist / immediate flush) |
| `widget:place` | Drop a sidebar inventory item onto the canvas (stamps first x/y) |

### Viewport-filtered broadcast (zones)

The board is divided by `ZoneService` into a **10×10 grid**. Every widget's bounding box maps to
the set of zones it overlaps; every connected client reports its viewport and subscribes only to
the zones it can currently see. When a widget changes, the server computes the affected zones and
fans the event out **only to clients subscribed to those zones** — not to everyone on the board.
This is the "wasted server bandwidth" fix: a user panned to the far corner never receives updates
for widgets they cannot see.

### Connection lifecycle states

Backgrounded tabs downgrade to a heartbeat-only low-resource state; on refocus, the client
fast-syncs the missing delta (the UI shows a "Syncing changes…" banner). This avoids idle
resource consumption from backgrounded tabs.

### Abuse prevention

Move and lock handlers include a **"mouse-teleportation" guard** — movements faster than humanly
possible across the grid coordinate system are rejected, blocking bot-driven scripted grabs.

---

## 6. The Lock Lifecycle (Core Domain)

Ownership of an inventory widget is modeled as a **distributed lock in Redis**, never as a SQL
row lock. This is what lets the system survive flash-sale burst velocity that would deadlock a
relational database. The lock has three visible states, color-coded for every viewer of the
canvas:

```
   ┌──────────┐   click    ┌────────────┐  checkout   ┌────────────┐   pay ✓   ┌───────────┐
   │  OPEN    │ ─────────► │  SOFT LOCK │ ──────────► │  HARD LOCK │ ────────► │ COMMITTED │
   │  (teal)  │            │  (amber)   │             │  (red)     │           │ (emerald) │
   └──────────┘            └─────┬──────┘             └─────┬──────┘           └───────────┘
        ▲                        │ 60s TTL                  │ 5min TTL
        │                        │ expires                  │ expires
        └────────────────────────┴──────────────────────────┘
                       lock auto-released, widget returns to canvas,
                       real-time event updates all connected clients
```

| State | Trigger | Redis mechanic | TTL | Broadcast |
| --- | --- | --- | --- | --- |
| **Soft lock** (amber) | Click a widget | `SET <key> <user> NX PX 60000` | 60s | `widget:lock:soft:fixed` board-wide |
| **Hard lock** (red) | Initiate checkout | Same key, TTL extended; widget tracked in a per-board set | 5min | `widget:lock:hard:fixed` board-wide |
| **Committed** (emerald) | Payment success | Lock cleared, widget row removed | — | `widget:purchased` |
| **Released** (back to open) | TTL expiry | Keyspace notification fires | — | `widget:lock:*:release` |

**Atomicity** comes from Redis `SET ... NX` — only one user can win the key, so two shoppers can
never both soft-lock the same widget. **Auto-release** comes from Redis keyspace expiry
notifications (`--notify-keyspace-events Ex`): when a soft/hard lock key dies, the gateway's
`resolveExpiredLock` handler reacts immediately, routing on a `paid` flag — paid → emit
`widget:purchased` and delete the row; unpaid → emit a release event so the amber/red widget
turns teal again for everyone. The "Reservation expired — item returned to canvas" toast is the
client-side reflection of this.

---

## 7. Checkout & Zero-Double-Spend Pipeline

Checkout is engineered so a single order can never be charged twice and a sold item can never be
sold again.

```
 Shopper holds hard locks ──► POST /orders { clientUuid, items }
                                     │
                                     ▼
              ┌─────────────────────────────────────────────┐
              │ Idempotency: clientUuid is a unique key       │
              │  • duplicate insert → returns ORIGINAL order  │  ◄── zero double-spend
              │    (no second charge)                         │
              ├─────────────────────────────────────────────┤
              │ Authority checks:                             │
              │  • buyer actually holds live locks on items   │
              │  • total is RE-COMPUTED server-side           │  ◄── no client-trusted price
              ├─────────────────────────────────────────────┤
              │ completePurchase():                           │
              │  • remove sold widget rows                    │
              │  • clear their Redis locks                    │
              │  • broadcast widget:purchased to touched zones│
              └─────────────────────────────────────────────┘
                                     │
                                     ▼
                  GET /orders/:id/invoice ──► streamed pdfkit PDF
```

Three independent guarantees stack:

1. **Idempotency key.** The order is keyed on a client-generated UUID; a retried/duplicated
   request hits the unique constraint and returns the *original* order instead of creating a new
   charge.
2. **Server-authoritative pricing.** The total is computed from the database, never trusted from
   the client payload.
3. **Lock verification.** The server confirms the buyer holds the live hard locks before
   committing — you cannot buy what you do not hold.

RabbitMQ decouples the burst: high-frequency position updates and checkout handoff are queued
rather than hammering PostgreSQL synchronously. The `WidgetPersistenceConsumer` drains queued
`widget:move` events and debounces them into `posX`/`posY` writes, so dragging a widget across the
canvas produces a smooth stream of socket broadcasts but only a settled write to the database.

---

## 8. Authentication, RBAC & Quota Enforcement

### Authentication
- JWTs issued on login and stored in **httpOnly cookies** (not localStorage).
- The realtime gateway reuses the same handshake cookie — `SocketAuthService` verifies the JWT
  *and* board ownership before allowing privileged socket actions.
- Google OAuth, password reset (single-use expiring tokens), and email verification are handled
  in the `auth` module; transactional emails render from `mail/templates`.

### Permissions (CASL)
A 20-permission catalog (`create:Board`, `update:SmartWidget`, …) is defined once and shared:
- **Backend:** `PermissionsGuard` checks the action/subject tuple per route.
- **Frontend:** the same tuples build a CASL `AppAbility` from `/auth/me`; a Next.js middleware
  stamps the current path, a server `PermissionGuard` redirects unmet routes to `/unauthorized`,
  and the sidebar hides inaccessible menu items.

Two unremovable system roles exist (`super-admin`, `tenant`); both super-admins and tenants can
mint additional custom roles with permission subsets.

### Quota enforcement
Plan limits (Free: 2 boards / 3 roles / 25 widgets-per-board; Pro: 15 / 20 / unlimited) are
enforced at the data layer via a **`userPlanSnapshot`** of remaining quota. `QuotaGuard`
decrements the relevant counter on each `CREATE`, overflowing into an "extra" bucket when a plan
expires. A nightly `@nestjs/schedule` cron downgrades lapsed tenants back to the free plan and
resets their quotas. Gating is intentionally bypassable during development for evaluation.

---

## 9. Frontend Architecture (Next.js)

The web app is **server-first**: server components fetch directly from the API; client components
exist only where interactivity demands it (canvas, sockets, forms).

| Surface | Description |
| --- | --- |
| `/` | Public marketing landing page (server-rendered with a few client islands) |
| `(auth)/` | Sign-in / sign-up / forgot / reset — RHF + Zod, server actions forwarding httpOnly cookies |
| `dashboard/` | Tenant workspace behind a `(shell)` layout: Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings |
| `dashboard/boards/[slug]` | The live **canvas editor** — pan/zoom, soft-lock, drag-drop placement, sidebar inventory |
| `b/[slug]` | **Public anonymous shopper route** — renders the realtime canvas in end-user mode (no inventory/Add/Import/Share, drag disabled), serves only *published* boards |
| `checkout/` | Standalone checkout page (RHF + Zod, `useSyncExternalStore` cart) |

### Canvas rendering
The canvas uses the **HTML5 Canvas 2D API** for hardware-accelerated, high-framerate rendering.
A transform matrix maps screen coordinates to grid coordinates so cursor telemetry, pan/zoom, and
widget hit-testing all stay consistent. A `useCanvasSocket` hook owns the socket.io connection,
emits viewport/cursor/lock/move events, and applies inbound broadcasts (peer cursors, moved
widgets, lock-state color transitions, purchases) to local state.

### Mutations
Form submissions and simple mutations go through **server actions** returning the project-wide
`{ success, data, error }` shape, surfaced to users via Sonner toasts. API routes are reserved for
webhooks, file uploads, and streaming (e.g. the invoice PDF).

---

## 10. Data Model

All tables are defined as Drizzle schemas in `apps/api/src/schemas` and migrated via committed SQL
(`apps/api/drizzle/migrations`, currently through `0004`).

```
user ──< user_group >── group ──< group_permission >── permissions
  │                       │
  │                       ├─ type: 'role' | 'plan'   (one table, two roles)
  │                       │
  ├──< user_plan_snapshot │   (remaining quota counters per tenant)
  ├──< payment_history    │
  │
  └──< board ──< smart_widget        (posX/posY = placement on canvas)
        │            │
        │            └──< order_item >── order ──> (idempotent on clientUuid)
```

| Table | Purpose |
| --- | --- |
| `user` | Tenants, sub-users, super-admins |
| `group` | Unified roles **and** plans, discriminated by `type` |
| `permissions` | The CASL action/subject catalog |
| `user_group`, `group_permission` | Many-to-many wiring of users↔roles and roles↔permissions |
| `user_plan_snapshot` | Per-tenant remaining-quota rows (drives `QuotaGuard`) |
| `payment_history` | Subscription payment ledger (feeds the Transactions table) |
| `board` | Canvas boards; `access` = `restricted`/`public`, unique slug |
| `smart_widget` | Inventory items; `posX`/`posY` distinguish sidebar vs placed-on-canvas |
| `order`, `order_item` | Checkout records; `order` is idempotent on a client UUID |

**Distinct-item rule.** Every widget is one DB record. Three sneakers sold separately = three
`smart_widget` rows of quantity 1; a single record of quantity 3 must be bought as the whole stock.

---

## 11. Infrastructure & Local Development

`docker-compose.yml` provisions the two stateful services the realtime engine depends on:

- **Redis 7** — started with `--notify-keyspace-events Ex` so the gateway receives key-expiry
  events that drive automatic lock release.
- **RabbitMQ 3 (management)** — AMQP on `5672`, management UI on `15672`.

```bash
docker compose up -d                       # Redis + RabbitMQ
pnpm --filter api db:generate              # generate migration from schema changes
pnpm --filter api db:migrate               # apply migrations
pnpm dev                                   # web :3000, api :3001 (turbo fan-out)
pnpm build                                 # cached production build across workspaces
```

PostgreSQL is configured via environment (not containerized in compose). Turbo caches build/lint/
type-check tasks across the `web`, `api`, and `common` workspaces.

---

## 12. Key Engineering Decisions

1. **Redis locks instead of SQL row locks.** Row-level `SELECT … FOR UPDATE` cannot absorb
   flash-sale burst velocity without lock contention. A single-threaded Redis `SET NX PX` gives
   atomic ownership *and* free TTL-based expiry.

2. **Keyspace notifications for auto-release.** Rather than polling for expired reservations, the
   server subscribes to Redis expiry events and reacts the instant a lock dies — the widget
   returns to the canvas for every viewer in real time.

3. **Zone-filtered broadcasting.** A 10×10 spatial grid + per-client viewport subscriptions mean a
   widget update reaches only the clients who can see it, not the whole board — bounded bandwidth
   regardless of board size or user count.

4. **RabbitMQ-debounced persistence.** Dragging a widget emits dozens of socket events per second
   for smooth peer rendering, but only a settled, debounced write reaches PostgreSQL — the broker
   absorbs the velocity mismatch.

5. **Three-layer double-spend defense.** Idempotency key + server-authoritative pricing + live-lock
   verification. Any one failing closed is enough; together they make a duplicate charge or a
   double sale structurally impossible.

6. **One `group` table for roles and plans.** Plans are modeled as permission groups with quota
   metadata, so the same permission-assignment machinery powers both RBAC and monetization.

7. **Shared permission catalog across the stack.** The exact same CASL tuples guard API routes and
   shape the React UI, so backend and frontend authorization can never silently drift apart.

---

*CollabGrid is a portfolio project demonstrating distributed real-time systems design: atomic
distributed locking, event-driven state machines, viewport-aware broadcast filtering, and
burst-safe transactional pipelines — built on a modern TypeScript monorepo.*
