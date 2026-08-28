# CollabGrid — Agent Guide

## Quick Commands

**API (Go) — run from `services/api/`:**

```bash
go run ./cmd/server    # start API server
go run ./cmd/seed      # seed DB (permissions, roles, packages, casbin rules)
go run ./cmd/migrate   # run Goose migrations
sqlc generate          # regenerate sqlc/ from queries/*.sql
go build ./... && go vet ./... && go test ./...
go test ./internal/service/auth # focused package tests
```

⚠️ Makefile targets `make build` and `make run` are **broken** — they reference `./cmd` and `cmd/main.go`, which no longer exist. Use the commands above.

**Web — run from `web/`:**

```bash
pnpm dev              # dev server (:3000)
pnpm lint             # eslint --max-warnings 0
pnpm check-types      # next typegen && tsc --noEmit
```

## Layout & Stack

- **Single Go module at repo root** (`github.com/asifulhaque087/loot-board`) — that's why all import paths start with `github.com/asifulhaque087/loot-board/services/api/...`.
- **API:** Go 1.25, pgx/v5, sqlc, chi/v5, casbin/v2, goose. Entrypoints: `services/api/cmd/{server,seed,migrate}/main.go`.
- **Web:** Next.js 16, Tailwind CSS v4 (`@theme` in CSS; **no** `tailwind.config.js`), `@t3-oss/env-nextjs` (`src/vars.ts`).
- **Infra:** Helm charts in `infra/charts/`, Dockerfiles in `infra/development/docker/`.

## Architecture & Conventions

- **Wiring:** `internal/module/main.module.go` builds pool → repos (`adapters/postgresql/repo`) → services → handlers → chi routes under `/api/v1`. `contract.go` defines the `Module` interface.
- **Middleware order per protected route group:** `JWTMiddleware` (injects `*JwtPayload` via `UserContextKey`) → `CasbinMiddleware` → `LimitGuard` (subscription usage checks).
- **Tenant scoping:** `GetUserFromContext(r.Context())` returns `*JwtPayload` (`ID`, `PrimaryUserID`, `SecondaryUserID`). Services resolve `parentId ?? userId` via a local `resolvePrimaryUserID` helper (duplicated per service package on purpose).
- **Service package layout** (`internal/service/{auth,boards,inventory,role}/`): `interfaces.go` declares the `Repo` interface (consumed by Service) and `Service` interface (consumed by Handler); `repo/` adapters convert sqlc row types ↔ service domain types; handlers map sentinel errors to HTTP status codes.
- **Transactions:** single-statement repos wrap `*sqlc.Queries`; multi-statement writes (e.g. role create/update) hold the `*pgxpool.Pool` and manage `pool.Begin/Commit/Rollback` internally.

## Casbin & Permissions (top gotcha)

- `CasbinMiddleware` enforces the **chi route pattern** (`RoutePattern()`) against policies seeded from `PermissionCatalog` in `internal/adapters/postgresql/seed.go` (matcher: `keyMatch2` on obj, `regexMatch` on act — method strings like `"PUT|PATCH"`/`"*"` are regexes).
- When adding/moving routes you MUST update `PermissionCatalog` endpoints to match the real route paths, then re-run `go run ./cmd/seed` — mismatches surface as 403s at runtime, not compile time.
- Role CRUD keeps Casbin in sync itself: `p(role_id, endpoint, method)` per granted permission (`syncRolePolicies` in the role service); role deletion also purges `g(user, role_id)` groupings. This is why `module.App.enforcer` is the concrete `*casbin.CasbinEnforcer`, not the narrow `auth.Enforcer` interface.

## SQLC Patterns

- Edit `queries/*.sql`, run `sqlc generate` (from `services/api/`). Never hand-edit `sqlc/` outputs. Schema comes from `migrations/` (embedded goose via `goose.SetBaseFS`).
- Partial update: `SET col = COALESCE(sqlc.narg('col'), col)` (see `UpdateBoard`/`UpdateSmartWidget`).
- Optional filter: `AND (sqlc.narg('board_id')::uuid IS NULL OR col = sqlc.narg('board_id'))`.
- Bulk insert: `:copyfrom` for plain inserts (`CreateSmartWidgets`); `unnest(sqlc.arg('ids')::uuid[])` for grant-style `:exec`.
- Batch select: `WHERE id = ANY($1::uuid[])` → `[]pgtype.UUID` param.
- **NUMERIC columns → `pgtype.Numeric`**: pass them through request/response DTOs as `*string`; convert with `Numeric.Scan(string)` / `Numeric.Value()` (returns a string). Don't put `pgtype.Numeric` straight into JSON response structs.

## Validator Gotchas (go-playground/v10)

- `number` tag matches **integers only** (`^[0-9]+$`) — use `numeric` for decimal strings.
- `omitempty` on pointer fields skips only `nil` pointers; an empty string still validates (normalize `""` → `nil` before `validate.Struct`).

## Testing Quirks (Go API)

- `module.NewTestModule()` injects `FakeRepo` (in-memory auth repo, guarded by `sync.RWMutex`), `FakeLimitGuardQueries`, `memUoW`, and `InitFakeCasbinEnforcer()`. Server setup: `app.NewServer(router, testModule)` + `httptest.NewServer(r)`.
- `test.module.go` currently registers **only auth (+demo) routes** — boards/inventory/role handlers are not wired there yet; add them when writing integration tests for those domains.
- Protected-endpoint tests need: registered user (for JWT), seeded `FakeLimitGuardQueries`, and `testModule.Enforcer.AddPolicy(...)` for the target endpoint.

## Branch Workflow

- Feature work goes on a feature branch cut from `golang`; when done: `git checkout golang && git merge <branch> && git branch -d <branch> && git push origin golang`.

## Stale Artifacts & Legacy Paths

- Root `README.md` / `BACKEND_ARCHITECTURE.md`: describe the legacy NestJS/Prisma monorepo (`apps/api`, `apps/web`, `@packages/common`).
- `context/`: legacy NestJS-era knowledge base. Its TS/React/Tailwind standards still describe `web/`, but all file paths in it are stale (`apps/...`).
- Path gotcha: the API lives at `services/api/` (NOT `api/` or `apps/api/`).
- Legacy `compose.yml` / `Dockerfile.dev` retain old `apps/` references — use `infra/` configurations instead.
