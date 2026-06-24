# Current Feature — Auth Pages (login, register, forgot-password, reset-password)

## Status

In Progress

## Goals

- Build four auth pages in `apps/web`, each wired to the existing `apps/api` auth endpoints:
  - **sign-in** (`/sign-in`) → `POST /auth/login` (fields: `email`, `password`); includes a "Forgot password?" link and a "Sign in with Google" button.
  - **sign-up** (`/sign-up`) → `POST /auth/register` (fields: `name`, `email`, `password`); includes a "Sign in with Google" button.
  - **forgot-password** → `POST /auth/forgot-password` (field: `email`); shows the generic success message.
  - **reset-password** → `POST /auth/reset-password` (fields: `token` from URL query, `password`); shows success then routes to login.
- Google OAuth button works: links to `GET /auth/google` on the API, which redirects back to `CLIENT_URL` after consent.
- Authenticated users are redirected away from these pages (cannot access login/register/forgot/reset once logged in).
- Pages match the landing page (`http://localhost:3000/`) UI/UX, layout, and theme for visual consistency.

## Notes

- **API base**: endpoints set httpOnly `accessToken`/`refreshToken` cookies (server-side). `GET /auth/me` returns profile + roles/permissions/quotas and is the way to detect a logged-in user (used for the redirect-away guard).
- **Validation (mirror DTOs with Zod)**: `name` 2–255 chars; `email` valid email; `password` 8–72 chars; reset `token` non-empty (from `?token=` query).
- **Field shapes** confirmed from `apps/api/src/auth/dto/*`:
  - register: `{ name, email, password }`
  - login: `{ email, password }`
  - forgot-password: `{ email }`
  - reset-password: `{ token, password }`
- **Responses**: login/register return `{ id, name, email, plan }`; forgot/reset return `{ message }`. Errors: 409 (email taken), 401 (bad credentials), 400 (invalid/expired reset token).
- **Google**: `GET /auth/google` → consent → `GET /auth/google/callback` sets cookies and redirects to `CLIENT_URL`. The button should hit the API URL directly (full-page navigation, not fetch).
- **Standards**: server components by default, `'use client'` only where needed; Server Actions for mutations; `tryit` instead of try/catch; `{ success, data, error }` return pattern; toast errors via sonner; RHF + Zod forms; ShadCN + Tailwind v4 tokens. Reuse the landing page's design tokens/components.

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
- **Auth & Seed Foundation** — Added CASL permissions catalog (`permissions.ts`), drizzle.config.ts, migrate.ts (prod runner), and idempotent seed script. Seeds 20 permissions, system roles (super-admin, tenant), plans (free/pro with quotas), and 2 seed users. Plan quotas are compile-time guaranteed to be a subset of tenant permissions.
- **Role Management** — NestJS role module (CRUD + permission listing), schema migration adding createdByUserId/createdAt to groupTable. Frontend: RolesView with shared modal state, AddRoleModal (create+edit), RolesTable with AlertDialog delete confirm, server actions.
- **RBAC Quota Enforcement** — Added grantedByUserId to groupTable (migration 0002), QuotaGuard (decrements plan snapshot remaining on CREATE, overflows to extra), refactored PermissionsGuard with plan-expiry overflow logic, fixed resolveCreatedBy parent-chain walk, wired guards to role controller.
- **Plan Management** — NestJS plan module (CRUD + permission listing) backed by GroupTable with type='plan', slug auto-generation, system-plan protection. Frontend: PlansView, PlansTable with AlertDialog delete confirm, AddPlanModal reused for create+edit, server actions.
