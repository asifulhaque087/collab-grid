# Current Feature — Subscription

## Status

In Progress

## Goals

- New `apps/api/src/subscription` NestJS module with a route handler guarded by `access-token.guard.ts`.
- DTO with `plan` (plan name) and `transactionId` properties.
- A new permission (e.g. `create:Subscription`) added to `permissions.ts` `PERMISSION_CATALOG`; re-run `apps/api/drizzle/seed.ts` so it lands in the catalog.
- Subscribe handler upgrades the user's plan:
  - For each plan-group permission (group `type === 'plan'`), add its `totalOperation` quota onto the matching `userPlanSnapshot` row (e.g. `board:create` += plan's `board:create`).
  - Compute new `planExpiresAt`: if the user's current plan is still active, extend from the existing expiry; if expired/new, start from now. Add a record to `paymentHistoryTable` (use a demo `transactionId`).
- Cron job (NestJS schedule) running daily at 12:00 AM:
  - Fetch all users with the `tenant` role.
  - If `planExpiresAt < now`, downgrade the user to the `free` plan.
  - Reset/overwrite that user's `userPlanSnapshot` quota values to the free plan's permission values.
- API endpoint to fetch records from `paymentHistoryTable`, surfaced in the frontend Transactions table.

## Notes

- Payment gateway (SSLCommerz/bKash/Nagad) integration is OUT of scope — a separate later feature. For now the handler is called directly with a plan name + a demo transaction id, and we just write the payment record.
- Plan quotas live on `groupPermissionTable.totalOperation` for groups where `type === 'plan'`; per-user entitlements are denormalized in `userPlanSnapshotTable` (`granted`, `remaining`, `extra`). Subscribe ADDS to existing snapshot values; cron downgrade RESETS them to free-plan values.
- User plan state: `userTable.plan` ('free' | 'pro') and `userTable.planExpiresAt` (date).
- `paymentHistoryTable` requires: `planName`, `durationMonth` (1|6|12|24), `amountPaid`, `transactionId`, `paymentMethod` ('bkash'|'nagad'|'sslcommerz'|'manual'), `startDate`, `endDate`.
- Mirror existing module structure/patterns from `apps/api/src/plans` and `apps/api/src/roles`.
- Use `@packages/common/src/tryit.ts` instead of try/catch (per coding standards).
- Cron needs `@nestjs/schedule` (verify it's installed/wired in `app.module.ts`).

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.
- **Homepage Design** — Built the public landing page at `/` from `prototypes/homepage.html` (nav, hero bento, interactive board demo, lock-lifecycle tabs, architecture, plans, footer; server-first with 3 client islands). Moved all dashboard pages under `/dashboard` (shell group + full-screen canvas). Canvas: swapped Add Widget→Add Inventory modal, removed snapshot tool.
- **Auth & Seed Foundation** — Added CASL permissions catalog (`permissions.ts`), drizzle.config.ts, migrate.ts (prod runner), and idempotent seed script. Seeds 20 permissions, system roles (super-admin, tenant), plans (free/pro with quotas), and 2 seed users. Plan quotas are compile-time guaranteed to be a subset of tenant permissions.
- **Role Management** — NestJS role module (CRUD + permission listing), schema migration adding createdByUserId/createdAt to groupTable. Frontend: RolesView with shared modal state, AddRoleModal (create+edit), RolesTable with AlertDialog delete confirm, server actions.
- **RBAC Quota Enforcement** — Added grantedByUserId to groupTable (migration 0002), QuotaGuard (decrements plan snapshot remaining on CREATE, overflows to extra), refactored PermissionsGuard with plan-expiry overflow logic, fixed resolveCreatedBy parent-chain walk, wired guards to role controller.
- **Plan Management** — NestJS plan module (CRUD + permission listing) backed by GroupTable with type='plan', slug auto-generation, system-plan protection. Frontend: PlansView, PlansTable with AlertDialog delete confirm, AddPlanModal reused for create+edit, server actions.
- **Auth Pages** — Built /sign-in, /sign-up, /forgot-password, /reset-password in apps/web ((auth) group, landing-page theme): RHF+Zod forms, server actions forwarding httpOnly cookies, GET /auth/me redirect-away guard, Google OAuth button, PasswordInput show/hide + client-only confirm-password. Fixed backend: applied unrun migration 0002, enabled esModuleInterop (bcryptjs/ms), nest-cli .ejs asset copy, rebranded reset email.
