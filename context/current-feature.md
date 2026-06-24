# Current Feature: Auth & Seed Foundation

## Status

In Progress

## Goals

- Define all CASL-compatible permissions (action × subject) derived from DB schema resources
- Seed `permissions` table with every action/subject combination
- Seed `group` table with two plan records (`free`, `pro`) including quota-based `groupPermission` rows
- Seed `group` table with two system role records (`super-admin`, `tenant`) and their `groupPermission` rows
- Seed representative users (one per role) with hashed password `qwerty1234%`
- Single idempotent seed script (`apps/api/src/seed.ts`) that can be re-run safely
- Build passes with no TypeScript errors after seeding

## Notes

- **Resources (CASL subjects):** `User`, `Group`, `Permission`, `Board`, `SmartWidget`, `PaymentHistory`, `UserPlanSnapshot`, `all`
- **Actions:** `create`, `read`, `update`, `delete`, `manage`
- **Roles (group.type = 'role', createdBy = 'constant'):**
  - `super-admin` — `manage all` permission
  - `tenant` — manage their own boards/widgets/users/roles; read plans
- **Plans (group.type = 'plan', createdBy = 'constant'):**
  - `free` — 2 boards (`totalOperation: 2`), 3 custom roles, 25 widgets/board
  - `pro` — 15 boards, 20 custom roles, unlimited widgets (`totalOperation: -1`)
- **Seed users:**
  - `admin@collabgrid.com` — super-admin role, plan: `pro`
  - `tenant@collabgrid.com` — tenant role, plan: `free`
  - Password for all: `qwerty1234%` (bcrypt-hashed at seed time)
- Use `bcrypt` or `argon2` to hash passwords in the seed script
- Seed script must be idempotent (use upsert / `onConflictDoNothing`)
- Run via `pnpm --filter api db:seed` (add script to `apps/api/package.json` if missing)

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
