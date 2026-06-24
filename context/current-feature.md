# Current Feature: Plan Management

## Status

In Progress

## Goals

- Plan CRUD (create, read, update, delete) in NestJS using the existing GroupTable with `type = 'plan'`
- Auto-generate slug from plan name on the backend
- Admin can send plan name + permissions when creating/editing a plan
- Frontend PlansView shows all plans in a table
- Existing AddPlan modal used for both create and edit (button label changes)
- Delete plan from table with an AlertDialog confirmation

## Notes

- Backend: model after `apps/api/src/roles` — create a `plan` module with the same CRUD pattern
- GroupTable is the shared table; differentiate by `type: 'plan'`
- Slug auto-generated server-side (no client input)
- Frontend modal already exists — wire it up rather than creating a new one
- Edit reuses the same modal, just swaps the submit button label

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
- **Auth & Seed Foundation** — Added CASL permissions catalog (`permissions.ts`), drizzle.config.ts, migrate.ts (prod runner), and idempotent seed script. Seeds 20 permissions, system roles (super-admin, tenant), plans (free/pro with quotas), and 2 seed users. Plan quotas are compile-time guaranteed to be a subset of tenant permissions.
- **Role Management** — NestJS role module (CRUD + permission listing), schema migration adding createdByUserId/createdAt to groupTable. Frontend: RolesView with shared modal state, AddRoleModal (create+edit), RolesTable with AlertDialog delete confirm, server actions.
- **RBAC Quota Enforcement** — Added grantedByUserId to groupTable (migration 0002), QuotaGuard (decrements plan snapshot remaining on CREATE, overflows to extra), refactored PermissionsGuard with plan-expiry overflow logic, fixed resolveCreatedBy parent-chain walk, wired guards to role controller.
