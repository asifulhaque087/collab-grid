# CollabGrid — Agent Guide

## Quick Commands

**Full stack (from repo root):**
```bash
docker compose watch    # web:3000, api:3001, redis, rabbitmq, pg
```

**API (Go) — from `api/`:**
```bash
make watch   # hot reload via Air (port from .env)
make run     # go run cmd/main.go
make build   # builds bin/api and bin/seed
make seed    # run database seed CLI
```

**Web (Next.js) — from `web/`:**
```bash
pnpm dev              # dev server on :3000
pnpm build            # production build
pnpm lint             # eslint --max-warnings 0
pnpm check-types      # next typegen && tsc --noEmit
```

**Database (SQLC) — from `api/`:**
```bash
sqlc generate         # regenerates sqlc-go from SQL queries in queries/
```

## Architecture

**Stack:** Go 1.25 · Next.js 16 · PostgreSQL (pgx/v5) · Redis · RabbitMQ · socket.io-client

```
api/          # Go backend (pgx, sqlc, net/http, JWT)
web/          # Next.js 16 app (app router, Tailwind v4, shadcn/ui)
```

**Current state:** API is early-stage. Auth (register, JWT, refresh) is wired. Redis/RabbitMQ configs are loaded but **no services use them yet** — the realtime canvas (socket.io, locks, zones, write-behind) exists as types/components on the web side only. See `web/src/types/realtime.ts` and `web/src/types/canvas.ts` for the planned contract.

## API Layout (Go)

```
api/
├── cmd/
│   ├── main.go               # entrypoint: config → pg pool → module → server
│   └── seed/main.go          # database seeder
├── internal/
│   ├── config/               # env loading (caarlos0/env, godotenv, validator)
│   ├── module/               # wire-up: app.go (prod), test.module.go (tests)
│   │   ├── app.go            # registers auth route (POST /users)
│   │   ├── contract.go       # Module interface (RegisterRoute(*http.ServeMux))
│   │   └── test.module.go    # in-memory fakes for testing
│   ├── app/server.go         # HTTP server, middleware chain, Start()
│   ├── adapters/postgresql/  # pgx pool, sqlc repo, migrations, UoW
│   │   ├── sqlc/             # GENERATED — don't edit by hand
│   │   ├── queries/          # .sql → sqlc input (auth.sql, seed.sql)
│   │   └── migrations/       # numbered .sql (auto-applied: not yet)
│   ├── domain/               # repo interfaces (AuthRepo), UnitOfWork
│   ├── service/auth/         # handler, service, e2e_test, repo.fake, types
│   └── util/                 # WriteJson, tryit helper
```

Key files:
- `cmd/main.go:33` — DB pool created at root, `module.NewApp` wires all modules
- `internal/module/app.go` — registers routes on `*http.ServeMux`
- `internal/adapters/postgresql/queries/*.sql` — edit these, run `sqlc generate`
- `internal/service/auth/e2e_test.go` — test pattern (uses `httptest.Server` + fakes)

## Web Layout (Next.js 16)

```
web/src/
├── app/
│   ├── (public)/             # landing, /b/[slug], /checkout
│   ├── (auth)/               # sign-in, sign-up, forgot/reset-password
│   ├── (private)/            # dashboard, subscription
│   ├── api/
│   │   ├── public/[[...path]]/route.ts   # BFF proxy to Go API (no auth)
│   │   └── private/[[...path]]/route.ts  # BFF proxy (injects bearer token)
│   └── layout.tsx
├── components/               # Radix UI + shadcn/ui components (17 feature dirs)
├── actions/                  # Server Actions (auth, boards, inventory, orders, etc.)
├── hooks/                    # use-canvas-socket, useThrottle
├── lib/                      # api.ts, auth.ts, ability.ts, canvas-mappers.ts, etc.
├── types/                    # canvas.ts, realtime.ts, home.ts
├── proxy.ts                  # Middleware logic (JWT verify, token rotation) — NOT wired as Next.js middleware yet (no `middleware.ts`)
├── env.ts                    # @t3-oss/env-nextjs validation
└── vars.ts                   # runtime env accessor
```

Key conventions:
- Route groups control auth boundaries: `(public)` / `(auth)` / `(private)` / `(utility)`
- BFF proxy (`api/private/*`, `api/public/*`) rewrites `/api/private/foo` → Go API at `GATEWAY_URL/foo`
- `proxy.ts` (middleware) validates JWT, rotates refresh tokens, injects `authorization` header
- Server components default; `'use client'` only for interactivity/socket/hooks
- Tailwind CSS v4 — **NO `tailwind.config.js`**; theme via `@theme` in `globals.css`

## Development

**Database:**
- Migrations in `api/internal/adapters/postgresql/migrations/` — NOT auto-applied on boot yet
- Seed: `make seed` from `api/`
- `sqlc generate` after editing `.sql` queries

**Testing:**
- API: `go test -v -run TestName ./internal/service/auth/...` (uses fakes, no DB needed)
- Web: no test runner configured yet

**Lint/Typecheck (CI order):**
```bash
cd api && go build ./... && go vet ./...
cd web && pnpm lint && pnpm check-types
```

## Environment

Required env files (not committed):

| File | Required keys |
|------|---------------|
| `api/.env` | `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `REDIS_URL`, `RABBITMQ_URL`, `PORT`, `CLIENT_URL`, `CORS_ORIGIN`, OAuth & SMTP fields |
| `web/.env` | `GATEWAY_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_SOCKET_URL` |

Docker compose overrides: `REDIS_URL=redis://redis:6379`, `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672`

## Gotchas & Conventions

| Area | Note |
|------|------|
| **README.md** | Describes old NestJS architecture (stale). Don't trust it. |
| **compose.yml** | References old paths (`apps/api/`, `apps/web/`, `packages/common/`) — paths don't match current layout. Dockerfiles at `api/Dockerfile.dev` and `web/Dockerfile` also have stale paths. |
| **SQLC** | Edit `.sql` files only; `sqlc/` is generated — don't edit by hand |
| **API config** | Loads `.env` via godotenv; validates with go-playground/validator; requires 20+ vars including OAuth, SMTP, Redis, RabbitMQ |
| **Auth** | JWT in httpOnly cookie set by BFF proxy; token rotation on expiry in `proxy.ts` |
| **CASL** | Mirrored in `web/src/lib/ability.ts` — mirrors Go API permission model |
| **Tailwind v4** | CSS-based config via `@theme` in `globals.css` — NO JS config file |
| **Web API routes** | `api/private/*` requires `authorization` header or throws 401; `api/public/*` passes auth through if present |
| **Routemux** | Go API uses `http.ServeMux` with method-based routing (`mux.HandleFunc("POST /path", handler)`) |
| **UoW pattern** | `domain.UnitOfWork` + `postgresql.UoW` wraps pgx transactions; test module uses in-memory `memUoW` |
| **Ports** | API=3001 (configurable via `PORT`), Web=3000, Redis=6379, RabbitMQ=5672/15672, PG=5432 |

## CI/CD (`.github/workflows/`)

| Workflow | Triggers | Notes |
|----------|----------|-------|
| `deploy-api.yml` | push to main (api/**) | Builds & pushes API image |
| `deploy-web.yml` | push to main (web/**) | Builds & pushes Web image |
| `deploy-ingress.yml` | push to main (charts/**) | Deploys ingress routes |

Helm charts in `charts/` (api, web, ingress-routes).

## Stale Artifacts to Ignore

The following files describe the pre-migration NestJS architecture and will mislead:
- `README.md` — entire content (describes NestJS/Drizzle/Redis locks/RabbitMQ that don't exist in Go API yet)
- `compose.yml` — paths reference old monorepo structure
- `web/Dockerfile` — references `apps/web/`, `apps/api/`, `packages/common/`, `pnpm-workspace.yaml` that don't exist
- `context/coding-standards.md` — references both Prisma and Drizzle, `@packages/common`, `@apps/api`; mostly stale

## References

- `BACKEND_ARCHITECTURE.md` — old NestJS deep-dive on concurrency, locking, write-behind, RBAC (concepts still valid as planned architecture)
- `ARCHITECTURE.md` — old system overview
- `context/features/*.spec.md` — feature specs (may be partly aspirational)
