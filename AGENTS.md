# CollabGrid — Agent Guide

## Quick Commands

**API (Go) — workdir `services/api/`:**
```bash
go run ./cmd/server   # start API server (or make run)
go run ./cmd/seed     # run database seeder (or make seed)
go run ./cmd/migrate  # run Goose database migrations
make build            # build binaries to build/api and build/seed
sqlc generate         # regenerate sqlc/ from queries/*.sql
go test ./...         # run all Go tests
go test ./internal/service/auth # run focused package tests
```

**Web (Next.js) — workdir `web/`:**
```bash
pnpm dev              # dev server (:3000)
pnpm build            # build web app
pnpm lint             # eslint --max-warnings 0
pnpm check-types      # next typegen && tsc --noEmit
```

**Validation Chain (CI order):**
```bash
cd services/api && go build ./... && go vet ./... && go test ./...
cd web && pnpm lint && pnpm check-types
```

## Stack & Directory Structure

- **API (`services/api/`):** Go 1.25, pgx/v5, sqlc, chi/v5, casbin/v2, goose migrations.
- **Web (`web/`):** Next.js 16, Tailwind CSS v4 (`@theme` directive in CSS; **no** `tailwind.config.js`), `@t3-oss/env-nextjs` (`src/vars.ts`).
- **Infra (`infra/`):** Helm charts in `infra/charts/`, Dockerfiles in `infra/development/docker/`.

## Architecture & Code Conventions

- **Entrypoints:** `services/api/cmd/server/main.go` (server), `cmd/seed/main.go` (seeder), `cmd/migrate/main.go` (migrations).
- **Module Wiring:** `internal/module/main.module.go` wires DB pool -> repos -> services -> handlers -> routes. `contract.go` defines `Module` interface (`RegisterRoute(r chi.Router)`).
- **Middleware Order:** `JWTMiddleware` (injects `*JwtPayload` into context via `UserContextKey`) -> `CasbinMiddleware` -> `LimitGuard` (subscription usage checks/updates).
- **User Extraction:** `GetUserFromContext(r.Context())` returns `*JwtPayload` (`ID`, `PrimaryUserID`, `SecondaryUserID`).
- **SQLC Workflow:** Schema in `internal/adapters/postgresql/migrations/`, queries in `internal/adapters/postgresql/queries/*.sql`. Edit SQL files and run `sqlc generate`. Never manually edit `sqlc/` outputs.
- **Goose Migrations:** Embedded via `goose.SetBaseFS(postgresql.EmbedMigrations)`. Run via `go run ./cmd/migrate`.

## Testing Quirks (Go API)

- Integration/E2E tests use `module.NewTestModule()` (`internal/module/test.module.go`) which injects `FakeRepo`, `FakeLimitGuardQueries`, `memUoW`, and `InitFakeCasbinEnforcer()`.
- Server setup for testing: `app.NewServer(router, testModule)` + `httptest.NewServer(r)`.
- Seeding test permissions: Register user for JWT, seed `FakeLimitGuardQueries` and call `testModule.Enforcer.AddPolicy(...)` for protected endpoints.
- `FakeRepo` embeds `repo.Querier` (thread-safe via `sync.RWMutex`).

## Stale Artifacts & Legacy Paths

- **Root `README.md` & `BACKEND_ARCHITECTURE.md`:** Reference legacy NestJS/Prisma monorepo layout (`apps/api`, `apps/web`, `@packages/common`).
- **Path Gotcha:** The API path is `services/api/` (NOT `api/` or `apps/api/`).
- **Docker/Compose files:** Some legacy files (`compose.yml`, `Dockerfile.dev`) retain old path references (`apps/`). Use `infra/` configurations for deployment.

