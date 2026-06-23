# Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

# Monorepo

This is a **Turborepo** monorepo managed with **pnpm**. The Next.js frontend lives in `apps/web` (port 3000); the NestJS backend API lives in `apps/api` (port 3001). Shared code (types, utility) will live in `packages/common`. Run the commands below from the repo root — turbo fans them out to the workspaces.

# Commands

- **Dev server**: `pnpm dev` (web on http://localhost:3000, api on http://localhost:3001)
- **Build**: `pnpm build`
- **Production server**: `pnpm start`
- **Lint**: `pnpm lint`

Drizzle/CLI commands that aren't wired as turbo tasks run inside the api app, e.g. `pnpm --filter api db:generate` then `pnpm --filter api db:migrate` (or `cd apps/api` first).
