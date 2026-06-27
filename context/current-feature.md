# Current Feature

## Status

Done — pending commit

## Goals

- Wire socket.io's Redis adapter so WebSocket broadcasts reach clients across multiple API
  instances, making the realtime tier horizontally scalable. ✅

## Verification

- Redis up → adapter logs "broadcasts are cluster-wide"; Redis down → falls back to in-memory,
  bootstrap completes fast (3s timeout).
- Two instances (:3001 + :3002) on one Redis: a soft lock emitted on :3001 was delivered to a
  client connected to :3002. Lint + build green.

## Notes

- Add a `RedisIoAdapter` extending `@nestjs/platform-socket.io`'s `IoAdapter`, attaching the Redis
  adapter built from two dedicated ioredis pub/sub clients (the adapter puts one client in
  subscriber mode, so it needs its own pair separate from the command/subscriber clients in
  `redis.module.ts`).
- Graceful degradation: if `REDIS_URL` is unset or Redis is unreachable, fall back to the default
  in-memory adapter (single-node) rather than crashing bootstrap.
- Wire it in `main.ts` via `app.useWebSocketAdapter(...)`.

## History

- **Widget Placement Persist & Broadcast** — dropping a sidebar inventory item onto the canvas now persists + broadcasts instead of mock-only local state. New `widget:place` socket event (gated by the same `canMove` check as moves; end users blocked) → `placeWidget` stamps first `posX`/`posY` onto the smart_widget row (board-scoped UPDATE…RETURNING + Redis sync), transitioning it sidebar → canvas, then fans out the **full widget DTO** as `widget:placed` to every zone its bounding box overlaps (`calculateWidgetOverlappingZones`). Frontend: drag carries the real inventory id, optimistic add, sidebar hides placed items, `onWidgetPlaced` renders peers' new widgets. Verified 9/9 (placement 7/7 + DB persist + zone routing 2/2).

- **Public End-User Board Route** — public `/b/[slug]` route (outside auth) renders the realtime canvas in anonymous shopper mode; unguarded `GET /boards/public/:slug` serves only published boards (else "not available" screen). Socket `board:join` gated: public → anyone, restricted → authenticated owner only. CanvasEditor `endUser` mode hides inventory/Add/Import/Share + disables drag. Board card Publish now sets access via updateBoard; share link uses real origin. Verified 4/4 (HTTP + socket gating).
- **Realtime Checkout & Payment** — order + order_item schema (migration 0004); public OrderModule: POST /orders idempotent on a client UUID (duplicate key → returns original order, no double charge), verifies the buyer holds live locks, server-computes total, then completePurchase removes sold widgets + clears locks + broadcasts widget:purchased; GET /orders/:id/invoice streams a pdfkit PDF. Frontend: standalone /checkout page (RHF+Zod, useSyncExternalStore cart) + order action; canvas checkout hands off cart and navigates. Verified 5/5 + DB + PDF.
- **Realtime Hard Lock** — `widget:lock:hard:init` (checkout) promotes the user's soft locks to 5-min hard locks (same Redis key, extended TTL, tracked in per-board set) → `widget:lock:hard:fixed` (red, board-wide). On key expiry, resolveExpiredLock routes: paid flag → `widget:purchased` + delete widget row; else `widget:lock:hard:release`. Frontend: checkout emits hard:init, red CSS state, purchased removes widget. Verified 3/3 events + DB.
- **Realtime Widget Move** — `widget:move` (debounced RabbitMQ persist) + `widget:move:end` (immediate); SocketAuthService gates moves to tenant/sub-user with update:SmartWidget (JWT from handshake cookie + board ownership), end users blocked. Redis position recovery; WidgetPersistenceConsumer writes posX/posY; broadcasts widget:moved/anchored to touched zones. Verified 4/4 socket + DB persist.
- **Realtime Canvas Foundation** — docker-compose (redis+rabbitmq) + env, NestJS `/canvas` socket.io gateway: board:join (presence+zones+widgets), cursor relay, viewport sync, atomic soft lock (SET NX PX) w/ bot guard + Redis keyspace-expiry auto-release. ZoneService (10×10 grid). Frontend useCanvasSocket hook + canvas-editor wiring. Verified 8/8 socket tests.
- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
- **Auth & Seed Foundation** — Added CASL permissions catalog (`permissions.ts`), drizzle.config.ts, migrate.ts (prod runner), and idempotent seed script. Seeds 20 permissions, system roles (super-admin, tenant), plans (free/pro with quotas), and 2 seed users. Plan quotas are compile-time guaranteed to be a subset of tenant permissions.
- **Role Management** — NestJS role module (CRUD + permission listing), schema migration adding createdByUserId/createdAt to groupTable. Frontend: RolesView with shared modal state, AddRoleModal (create+edit), RolesTable with AlertDialog delete confirm, server actions.
- **RBAC Quota Enforcement** — Added grantedByUserId to groupTable (migration 0002), QuotaGuard (decrements plan snapshot remaining on CREATE, overflows to extra), refactored PermissionsGuard with plan-expiry overflow logic, fixed resolveCreatedBy parent-chain walk, wired guards to role controller.
- **Plan Management** — NestJS plan module (CRUD + permission listing) backed by GroupTable with type='plan', slug auto-generation, system-plan protection. Frontend: PlansView, PlansTable with AlertDialog delete confirm, AddPlanModal reused for create+edit, server actions.
- **Auth Pages** — Built /sign-in, /sign-up, /forgot-password, /reset-password in apps/web ((auth) group, landing-page theme): RHF+Zod forms, server actions forwarding httpOnly cookies, GET /auth/me redirect-away guard, Google OAuth button, PasswordInput show/hide + client-only confirm-password. Fixed backend: applied unrun migration 0002, enabled esModuleInterop (bcryptjs/ms), nest-cli .ejs asset copy, rebranded reset email.
- **Subscription** — NestJS subscription module: POST /subscription adds plan quotas onto userPlanSnapshot (numeric row), extends/starts planExpiresAt, writes payment_history (demo txn id); GET /subscription/payments feeds the Transactions table; @nestjs/schedule cron downgrades expired tenants to free nightly and resets quotas. Added create:Subscription permission + reseed. Fixed pre-existing blocker: registered cookie-parser so AccessTokenGuard reads auth cookies.
- **Frontend RBAC** — CASL layer in apps/web mirroring the API permission model. `ability.ts` builds an AppAbility from /auth/me tuples; Next 16 `proxy.ts` stamps x-current-path; server `PermissionGuard` redirects to new `/unauthorized` when a route's required permission (route-permissions.ts map) is unmet; client `PermissionProvider`/`usePermission` exposes permissions+ability and the sidebar hides inaccessible items. Added `requireAuth()`; wired both into the (shell) layout.
- **Board Management** — NestJS boards module (tenant-scoped CRUD over boardTable, restricted/public access, unique-slug w/ collision suffix, AccessToken+Permissions+Quota guards on Board subject). Schema: `access` column + unique slug (migration 0003). Seed now grants the tenant a free-plan userPlanSnapshot (quota rows for create perms, null boolean-capability rows for the rest) so tenant grants resolve — also unblocks roles/plans. Frontend: /dashboard/boards fetches real boards; BoardCard with edit + delete (AlertDialog confirm); create-board-modal wired as create+edit; ApiBoard type + board server actions.
- **Inventory Smart Widget** — NestJS inventory module: tenant-scoped CRUD over smartWidgetTable (AccessToken+Permissions+Quota on SmartWidget, no reseed — subject pre-existed) + CSV bulk-import endpoint (FileInterceptor, distinct record per row); added GET /boards/by-slug/:slug. Frontend: inventory server actions + ApiInventory type; 3 create entry points (inventory page modal, board card import, canvas add modal) wired real — board/canvas creations attach boardId, no posX/posY by default. AddInventoryModal trimmed to real table columns (Controller-based board select). Inventory page/table real data with edit/delete/attach; canvas resolves real board by slug + shows its inventory in sidebar.
