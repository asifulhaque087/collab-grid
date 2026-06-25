# Current Feature: Frontend RBAC

## Status

In Progress

## Goals

- Implement a CASL-based RBAC layer in `apps/web` that mirrors the server's `permissions.ts` action/subject model.
- `ability.ts` (in `src/lib`): exports `Action`/`Subjects` enums, `PermissionTuple` type, `AppAbility`, and `createAbilityFor(user)` that builds a CASL ability from the user's effective permission tuples.
- `proxy.ts` (Next middleware): set `x-current-path` header on each request so the server guard can resolve the current route; matcher limited to `/dashboard/:path*`.
- `PermissionGuard` (server component): read `x-current-path`, look up required permission via `getRequiredPermissionForPath(path)`, build ability from current user, redirect to `/unauthorized` when `ability.can(...)` fails.
- Wrap `<PermissionGuard>` around dashboard `children` in the dashboard layout.
- `PermissionProvider` (client provider, currently named `DashboardProvider`): supplies the user's `permissions` to client components via a `usePermission`/`useDashboard` hook.
- Wrap the dashboard layout with `<PermissionProvider permissions={user.permissions ?? []}>` so client components can read permissions.

## Notes

- Subjects enum in the spec is a generic template (Prescription/Patient/etc.) — must be replaced with CollabGrid's real subjects from `apps/api/src/auth/permissions.ts` (e.g. Board, Inventory, User, Role, Plan, Subscription, Payment, Order, Transaction).
- Need a `getRequiredPermissionForPath` helper + a route→permission map file (not provided in spec).
- Need an `/unauthorized` page for redirect target.
- Server guard currently calls get-current-user per page switch; spec notes this could later read the JWT directly with the server secret, but per-page `getCurrentUser` is acceptable (cached result).
- `Can` component from `@casl/react` not included in steps; optional — may add for conditional UI rendering.
- Provider example in spec has stale doctor/dashboard template references to clean up.

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
- **Auth & Seed Foundation** — Added CASL permissions catalog (`permissions.ts`), drizzle.config.ts, migrate.ts (prod runner), and idempotent seed script. Seeds 20 permissions, system roles (super-admin, tenant), plans (free/pro with quotas), and 2 seed users. Plan quotas are compile-time guaranteed to be a subset of tenant permissions.
- **Role Management** — NestJS role module (CRUD + permission listing), schema migration adding createdByUserId/createdAt to groupTable. Frontend: RolesView with shared modal state, AddRoleModal (create+edit), RolesTable with AlertDialog delete confirm, server actions.
- **RBAC Quota Enforcement** — Added grantedByUserId to groupTable (migration 0002), QuotaGuard (decrements plan snapshot remaining on CREATE, overflows to extra), refactored PermissionsGuard with plan-expiry overflow logic, fixed resolveCreatedBy parent-chain walk, wired guards to role controller.
- **Plan Management** — NestJS plan module (CRUD + permission listing) backed by GroupTable with type='plan', slug auto-generation, system-plan protection. Frontend: PlansView, PlansTable with AlertDialog delete confirm, AddPlanModal reused for create+edit, server actions.
- **Auth Pages** — Built /sign-in, /sign-up, /forgot-password, /reset-password in apps/web ((auth) group, landing-page theme): RHF+Zod forms, server actions forwarding httpOnly cookies, GET /auth/me redirect-away guard, Google OAuth button, PasswordInput show/hide + client-only confirm-password. Fixed backend: applied unrun migration 0002, enabled esModuleInterop (bcryptjs/ms), nest-cli .ejs asset copy, rebranded reset email.
- **Subscription** — NestJS subscription module: POST /subscription adds plan quotas onto userPlanSnapshot (numeric row), extends/starts planExpiresAt, writes payment_history (demo txn id); GET /subscription/payments feeds the Transactions table; @nestjs/schedule cron downgrades expired tenants to free nightly and resets quotas. Added create:Subscription permission + reseed. Fixed pre-existing blocker: registered cookie-parser so AccessTokenGuard reads auth cookies.
