# Current Feature: Role Management

## Status

In Progress

## Goals

- Backend role module with full CRUD (create, read, update, delete)
- Role creation accepts role name + permissions; slug is auto-generated; createdBy tracks admin/tenant; type is always "role"
- Frontend roles table displays all roles
- Delete role via table delete icon with confirmation dialog
- Edit role via table edit icon reusing the existing add-role modal (button label changes to "Update")
- Existing "Add Role" modal wired up to the new backend endpoint

## Notes

- Spec file: `context/features/4-role-management.spec.md`
- Slug auto-generation from role name (e.g. "Super Admin" → "super-admin")
- `createdBy` field should reference the logged-in admin or tenant user
- `type` field is always `"role"` (enum or constant)
- Reuse the existing add-role modal for both create and edit flows

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
- **Auth & Seed Foundation** — Added CASL permissions catalog (`permissions.ts`), drizzle.config.ts, migrate.ts (prod runner), and idempotent seed script. Seeds 20 permissions, system roles (super-admin, tenant), plans (free/pro with quotas), and 2 seed users. Plan quotas are compile-time guaranteed to be a subset of tenant permissions.
