# Current Feature: Inventory Smart Widget Management

## Status

In Progress

## Goals

- Backend: create an `inventory` NestJS module with full CRUD over `smartWidgetTable` (tenant-scoped, guarded like boards/roles).
- Backend: add CSV bulk-import endpoint (used by the board card's "Import Inventory" action).
- Frontend: support creating inventory from 3 entry points — the board card Import Inventory button, the New Inventory modal on `/dashboard/inventory`, and the Add modal in the canvas editor.
- Inventory created via board card or canvas editor must carry a `boardId`; inventory has no `posX/posY` by default.
- Tenant-owned inventory attached to a board shows in the canvas editor's left/right sidebar so it can later be dragged onto the canvas.
- Sync form fields with the DB table: strip the extra fields from the current Add Inventory modal and use only `smartWidgetTable` columns.

## Notes

- `smartWidgetTable` columns: `id`, `tenantId` (notNull), `boardId` (nullable, set-null on board delete), `sku` (notNull), `photo` (nullable), `quantity` (int notNull), `price` (numeric nullable), `name` (notNull), `posX`/`posY` (numeric nullable), `width` (int notNull), `height` (int notNull), `createdAt`, `updatedAt`.
- Distinct-item NFR: each widget is a separate record; quantity sold as a whole stock per record.
- Auth: `Subjects.SmartWidget` already exists in `permissions.ts` (full CRUD), is granted to the tenant role + free/pro `create:SmartWidget` quota in `PLAN_QUOTAS`, and the tenant snapshot already includes it. So NO reseed/migration needed — just guard the inventory module with AccessToken + Permissions + Quota on `Subjects.SmartWidget`, same as boards.
- Default no `posX/posY` until dragged onto canvas. Import flow redirects to the board afterward (per project spec).
- Frontend uses RHF + Zod, server actions returning `{ success, data, error }`, sonner toasts, ShadCN modals.

## History

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
