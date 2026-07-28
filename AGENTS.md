# CollabGrid — Agent Guide

## Quick Commands

**Full stack (from repo root):**
```bash
docker compose watch          # full stack with hot reload (web:3000, api:3001, redis, rabbitmq, pg)
```

**API (Go) — from `api/`:**
```bash
make watch        # hot reload via Air (port 3001)
make run          # run directly (port from .env)
make build        # builds bin/api and bin/seed
make seed         # run database seed CLI
```

**Web (Next.js) — from `web/`:**
```bash
pnpm dev          # dev server on :3000
pnpm build        # production build
pnpm lint         # eslint --max-warnings 0
pnpm check-types  # next typegen && tsc --noEmit
```

**Database (SQLC):**
```bash
# from api/ — regenerates sqlc-go code from SQL queries
sqlc generate
```

---

## Architecture Overview

**Stack:** Go 1.25 · Next.js 16 · PostgreSQL (pgx) · Redis (keyspace events) · RabbitMQ · socket.io

**Key services (from compose.yml):**
| Service | Port | Purpose |
|---------|------|---------|
| web | 3000 | Next.js app (app router) |
| api | 3001 | Go HTTP + WebSocket server |
| redis | 6379 | Atomic locks, presence, write-behind cache, keyspace expiry events (`notify-keyspace-events Ex`) |
| rabbitmq | 5672/15672 | Debounced widget persistence queue + async checkout |
| postgres | 5432 | System of record (boards, widgets, orders, users, plans) |

**Architecture is problem-first:** see `BACKEND_ARCHITECTURE.md` and `ARCHITECTURE.md` for the deep dive. Key patterns:
- **Atomic Redis locks** (`SET NX PX`) for inventory — no DB row locks
- **Write-behind cache + debounced RabbitMQ** → 60fps WebSocket writes → ~1 DB write/drag
- **Idempotency keys + server-authoritative totals** → zero double-charge
- **Redis keyspace expiry events** → auto-release locks + broadcast without polling
- **10×10 spatial zone sharding** → viewport-scoped socket.io broadcasts
- **CASL abilities + plan snapshots** → capability + quota RBAC
- **Redis Pub/Sub adapter** → multi-node WebSocket scaling

---

## API Module Layout (Go)

```
api/
├── cmd/
│   ├── main.go       # entrypoint: config → pg pool → module → server
│   └── seed/main.go  # database seeder
├── internal/
│   ├── config/       # env loading (caarlos0/env)
│   ├── module/       # wire-up: app.go (prod), test.module.go (tests)
│   │   ├── app.go           # real modules (auth, boards, inventory, orders, ...)
│   │   ├── contract.go      # Module interface (RegisterRoute)
│   │   └── test.module.go   # fakes for testing
│   ├── app/server.go        # HTTP mux + middleware + module routes
│   ├── adapters/postgresql/ # pgx pool, sqlc-generated repo, migrations
│   │   ├── sqlc/            # generated code (run `sqlc generate`)
│   │   ├── queries/         # .sql files → sqlc
│   │   └── migrations/      # numbered .sql files
│   ├── service/auth/        # auth module (JWT, CASL, guards)
│   └── util/util.go         # tryit() helper → [T, error] tuples
```

**Key files to know:**
- `cmd/main.go:34` — DB pool created at app root, passed to module
- `internal/module/app.go` — wires all feature modules
- `internal/module/contract.go` — `Module` interface (`RegisterRoute(*http.ServeMux)`)
- `internal/adapters/postgresql/queries/*.sql` — edit these, run `sqlc generate`

---

## Web App Structure (Next.js 16 App Router)

```
web/src/
├── app/
│   ├── (public)/           # landing, checkout, public board view
│   ├── (auth)/             # sign-in, sign-up, reset-password
│   ├── (private)/          # authenticated dashboard
│   │   └── dashboard/(shell)/  # boards, inventory, orders, roles, settings...
│   ├── api/
│   │   ├── public/[[...path]]/route.ts   # proxies to Go API (public)
│   │   └── private/[[...path]]/route.ts  # proxies to Go API (authed, cookies)
│   └── layout.tsx
├── components/             # UI components (Radix + Tailwind 4)
├── hooks/                  # use-canvas-socket, useThrottle
├── lib/
│   ├── api.ts              # typed fetch wrapper to Go API
│   ├── auth.ts             # server-side auth (cookies, JWT via jose)
│   ├── ability.ts          # CASL ability factory (mirrors backend)
│   ├── canvas-mappers.ts   # DTO ↔ UI transforms
│   └── route-permissions.ts# route → permission map for guards
├── types/                  # shared TS types (canvas, realtime, etc.)
└── env.ts                  # @t3-oss/env-nextjs validation
```

**Key conventions:**
- Route groups: `(public)`, `(auth)`, `(private)` for layout/auth boundaries
- API routes proxy to Go backend (`NEXT_PUBLIC_GATEWAY_URL`)
- Server components default; `'use client'` for socket/hooks/forms
- CASL abilities mirrored in `lib/ability.ts` for client-side guards

---

## Development Workflow

**Database:**
- Migrations in `api/internal/adapters/postgresql/migrations/` (numbered SQL files)
- Run migrations: applied automatically on API boot (see `postgresql/connection.go`)
- Seed data: `make seed` (runs `cmd/seed/main.go` → `sqlc/seed.sql.go`)

**Code generation:**
```bash
# API: regenerate sqlc after editing .sql queries
cd api && sqlc generate

# Web: types generated via `pnpm check-types` (next typegen + tsc)
```

**Testing:**
- API: `*_test.go` files alongside code (see `auth/e2e_test.go` pattern)
- No test runner configured in web yet — add Vitest/Jest if needed

**Lint/Typecheck order (CI):**
```bash
# API (no linter configured yet — go vet / go build)
cd api && go build ./... && go vet ./...

# Web
cd web && pnpm lint && pnpm check-types
```

---

## Environment & Secrets

**Required env files (not committed):**
| File | Required keys |
|------|---------------|
| `api/.env` | `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `RABBITMQ_URL`, `PORT` |
| `web/.env` | `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_APP_URL` |

**Docker overrides (compose.yml):**
- `REDIS_URL=redis://redis:6379`
- `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672`

**Production secrets:** stored in `.github/secrets/` (see `.github/secrets/README.md`)

---

## Common Tasks

**Add a new API endpoint:**
1. Define SQL in `api/internal/adapters/postgresql/queries/`
2. Run `cd api && sqlc generate`
3. Add repo method in `store.go`
4. Add handler in appropriate `service/` module
5. Register route in module's `RegisterRoute(mux)`

**Add a WebSocket event:**
1. Gateway: `apps/api/internal/realtime/realtime.gateway.ts` — add `@SubscribeMessage`
2. Service: `realtime.service.ts` — implement logic (locks, cache, broadcast)
3. Client: `web/src/hooks/use-canvas-socket.ts` — add typed emit/listen

**Add a DB migration:**
1. Create `api/internal/adapters/postgresql/migrations/YYYYMMDDHHMMSS_name.sql`
2. Restart API — migrations run on boot

**Run single test (API):**
```bash
cd api && go test -v -run TestName ./internal/service/auth/...
```

---

## Gotchas & Conventions

| Area | Note |
|------|------|
| **DB** | Uses `pgx/v5` pool; migrations auto-run on startup (`connection.go`) |
| **SQLC** | Edit `.sql` files only; generated code in `sqlc/` — don't edit by hand |
| **Redis** | Two clients: command + subscriber (keyspace events need subscriber mode) |
| **RabbitMQ** | Debounced publisher (`rabbitmq.service.ts`) coalesces 60fps → ~2/sec |
| **Auth** | JWT in httpOnly cookie; same cookie read by WS handshake (`socket-auth.service.ts`) |
| **CASL** | Abilities built in `permissions.guard.ts`; mirrored in `web/lib/ability.ts` |
| **WebSocket** | Namespace `/canvas`; rooms = `board:<id>`, `board:<id>:zone:<x>_<y>` |
| **Zone grid** | Fixed 10,000×10,000 world → 10×10 zones (1000px each) — see `zone.service.ts` |
| **Ports** | API=3001, Web=3000, Redis=6379, RabbitMQ=5672/15672, PG=5432 |

---

## CI/CD (`.github/workflows/`)

| Workflow | Triggers | Notes |
|----------|----------|-------|
| `deploy-api.yml` | push to main (api/**) | Builds & pushes API image |
| `deploy-web.yml` | push to main (web/**) | Builds & pushes Web image |
| `deploy-ingress.yml` | push to main (charts/**) | Deploys ingress routes |

Helm charts in `charts/` (api, web, ingress-routes).

---

## References

- `BACKEND_ARCHITECTURE.md` — deep-dive on concurrency, locking, write-behind, RBAC
- `ARCHITECTURE.md` — system overview, data flows
- `context/features/*.spec.md` — feature specs (auth, canvas, locks, billing, etc.)
- `context/coding-standards.md` — code style guidelines