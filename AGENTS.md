# LootBoard

**Monorepo** — Turborepo + pnpm. Workspaces: `apps/web` (Next.js 16), `apps/api` (NestJS), `packages/common` (shared types + `tryit()`).

## Dev workflow

```bash
docker compose up -d              # Redis + RabbitMQ (local dev infra)
pnpm install && pnpm --filter @loot-board/common build   # common must be built first
pnpm dev                          # turbo fan-out: web :3000, api :3001
```

Verification: `pnpm build` (turbo cached). No test files exist in the repo.

## Commands

| Command                                       | Scope                                                  |
| --------------------------------------------- | ------------------------------------------------------ |
| `pnpm dev` / `build` / `lint` / `check-types` | turbo — all workspaces                                 |
| `pnpm format`                                 | prettier across `**/*.{ts,tsx,md}`                     |
| `pnpm --filter api test`                      | vitest (no tests written yet)                          |
| `pnpm --filter web lint`                      | eslint `--max-warnings 0`                              |
| `pnpm --filter api db:generate`               | `drizzle-kit generate` (schema → migration)            |
| `pnpm db:migrate`                             | prod migrate runner (`dist-migration/drizzle/migrate`) |
| `pnpm db:migrate-and-seed`                    | migrate + seed                                         |
| `pnpm clean` / `clean:all`                    | rm .turbo, dist, node_modules                          |

## Architecture

Real-time collaborative canvas (reactive commerce). Key files at root: `ARCHITECTURE.md`, `BACKEND_ARCHITECTURE.md`. Living spec in `context/` dir.

- **api** (port 3001) — NestJS, Drizzle ORM, socket.io, Redis locks, RabbitMQ debounced persistence
- **web** (port 3000) — Next.js 16 App Router, Tailwind CSS v4 (CSS `@theme` — **never** `tailwind.config.js`), ShadCN, Zustand, RHF+Zod
- **common** — `tryit()` error helper (used everywhere instead of try/catch)
- **Deploy**: Docker multi-stage → Helm → Kubernetes via GitHub Actions (3 workflows: api, web, ingress)

## Conventions

- **Error handling**: use `tryit()` from `@loot-board/common`, returns `{ success, data, error }`
- **Validation**: Zod everywhere
- **Permissions**: CASL `AppAbility` shared across backend guards + frontend UI gating
- **DB**: Drizzle ORM, migrations committed at `apps/api/drizzle/migrations/`
- **Auth**: JWT bearer tokens (not cookies), WebSocket uses short-lived WS token via `POST /realtime/token-exchange`
- **WebSocket**: socket.io `/canvas` namespace, 10×10 zone grid, Redis pub/sub adapter for multi-instance

## Style

- `apps/web/src/components/[feature]/kebab-case.tsx`
- Server components by default; `'use client'` only for interactivity
- No inline styles, dark-mode first
- Conventional commits (`feat:`, `fix:`, `chore:`) — no AI names in messages
- Ask before committing; feature/fix branches merged to `dev`
