# AGENTS.md

## ⚠️ Documentation is stale — trust the Go code, not the docs
`README.md`, `context/*.md`, and `.github/workflows/*` describe a **TypeScript/NestJS + Turborepo** monorepo (`apps/api`, `packages/common`, Drizzle/Prisma). **That code does not exist in this repo.** The real implementation is Go. Treat those docs as an aspirational spec only; the executable source (Go files, `go.mod`, `sqlc.yaml`, `config.go`) is the source of truth.

## Layout
- Go module root is the repo root (`github.com/asifulhaque087/loot-board`).
- `services/api` — the Go API (chi, sqlc, goose, casbin, pgx, redis, rabbitmq, gorilla/websocket, templ). Entrypoints: `services/api/cmd/{server,migrate,seed}/main.go`.
- `services/web` — a **separate** Next.js 16 app with its own `package.json`; it is NOT part of the Go module. Don't expect `npm`/`pnpm` commands to affect the Go service.
- No `Makefile`/`Taskfile`. Local orchestration is via the `Tiltfile` (k8s + Tilt). There is no conventional task runner.

## Build & run
```
go build -o build/api/server  ./services/api/cmd/server
go build -o build/api/migrate ./services/api/cmd/migrate
go build -o build/api/seed    ./services/api/cmd/seed
```
Container builds add `CGO_ENABLED=0 GOOS=linux GOARCH=amd64` (see `Tiltfile`).

All three binaries call `config.Load()`, which loads `.env` via godotenv then parses env with `caarlos0/env`. **Every config field is `required` with strict validation** (`url`, `hostname`, `min=16` for secrets). You cannot run them without a fully populated `.env` (incl. `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, Google OAuth, SMTP, token secrets).

## Database migrations (goose)
- Migration SQL files live in `services/api/internal/adapters/postgresql/migrations` and are embedded (`postgresql.EmbedMigrations`).
- Run `./build/api/migrate` to apply them (`goose Up`). It also **creates the target database if missing** via `ensureDatabaseExists`.
- Add new migrations as SQL files in that directory; they are embedded at build time, so they must be committed.

## Codegen — regenerate after editing source files
- **sqlc**: after editing any `.sql` under `services/api/internal/adapters/postgresql/queries/`, run `sqlc generate` from `services/api` (config: `services/api/sqlc.yaml`). Output: `services/api/internal/adapters/postgresql/sqlc/`. Never hand-edit generated files.
- **templ**: after editing `*.templ` under `services/api/internal/mail/templates/`, run `templ generate` (binary: `~/go/bin/templ`). Output: `*_templ.go`.
- Both `sqlc` and `templ` are required toolchain pieces; if generated code looks stale, regenerate before debugging.

## Architecture / wiring
- HTTP: chi router. `module.NewApp` (`services/api/internal/module/main.module.go`) is the DI root: sqlc queries → repos → unit-of-work → services → handlers, plus casbin enforcer and mailer.
- Domain services live in `services/api/internal/service/<domain>/` as `service.go` + `handler.go` + `dto.go` + `interfaces.go` (+ `mock/` for tests). Follow this shape for new domains.
- RBAC: casbin with a pgx adapter (`casbin-pgx-adapter`); model is embedded from `services/api/internal/config/model.conf`. Enforcer is initialized against the DB in `main` and `seed`.
- Realtime: `service/realtime` uses gorilla/websocket + redis (locks/presence/write-behind positions) + rabbitmq (debounced persistence). Keep cross-client traffic in named rooms, not raw socket ids.

## Tests
- Run: `go test ./services/api/...`.
- Auth/realtime tests use **in-memory fakes** (`module.NewTestModule`, `auth_mock`) and the fake casbin enforcer, so they run **without** a live Postgres/Redis/RabbitMQ. Do not add external-infra dependencies to these tests.

## CI caveat
`.github/workflows/deploy-*.yml` reference `apps/api`, `packages/common`, `charts/api`, and `./apps/api/Dockerfile` — none of which exist (real: `services/api`, `infra/charts/api`, `infra/development/docker/Dockerfile.api`). Those workflows are stale and will not match this layout.
