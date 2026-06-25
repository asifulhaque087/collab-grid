# Current Feature: Board Management (CRUD)

## Status

In Progress

## Goals

- Backend: create a `board` module in `apps/api` with full CRUD backed by `boardTable` (`apps/api/src/schemas/index.ts`).
- Backend: support board access mode on create — restricted (invite) or public URL.
- Backend: secure the controller with `@RequirePermission`, `PermissionsGuard`, and `QuotaGuard`.
- Frontend: render the real board list on `/dashboard/boards` with dynamic data from the API.
- Frontend: add edit + delete icons on each board card, with a delete confirmation dialog.
- Frontend: create boards via the boards-page create modal, with required fields synced to the backend contract.

## Notes

- Development mode — DB table modifications to `boardTable` are allowed if needed.
- Keep required fields synced between backend schema/DTO and frontend RHF+Zod form.
- Follow existing module patterns (role/plan modules) for guards, server actions, and modal/table structure.

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
