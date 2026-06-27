# syntax=docker/dockerfile:1

# Multi-stage build for the NestJS API (apps/api) in a pnpm/turborepo monorepo.
# Build context is the REPO ROOT so the workspace + @collab-grid/common resolve.
#   docker build -f apps/api/Dockerfile --target production -t collabgrid-api .

############################
# Base — pnpm via corepack #
############################
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

##############################################
# Dependencies — full install (api + common) #
##############################################
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/common/package.json ./packages/common/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api...

#######################################################
# Production deps — prod-only install for a lean image #
#######################################################
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/common/package.json ./packages/common/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter api...

#################################################
# Development — hot-reload target for compose   #
#################################################
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/ ./
COPY . .
EXPOSE 3001
# common must be compiled before nest watch resolves its types/dist.
CMD ["sh", "-c", "pnpm --filter @collab-grid/common build && pnpm --filter api dev"]

#################################################
# Build — compile common + api to dist          #
#################################################
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/common/node_modules ./packages/common/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/common/package.json ./packages/common/
COPY packages/common ./packages/common
COPY apps/api ./apps/api
RUN pnpm --filter @collab-grid/common build \
 && pnpm --filter api build

#################################################
# Production — minimal runtime image            #
#################################################
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

# Prod-only node_modules (pnpm symlinks preserved by matching the layout).
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=prod-deps --chown=nestjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Built workspace dependency (api resolves @collab-grid/common via its symlink).
COPY --from=build --chown=nestjs:nodejs /app/packages/common/package.json ./packages/common/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/common/dist ./packages/common/dist

# Compiled API (dist/main + copied .ejs mail templates).
COPY --from=build --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

USER nestjs
WORKDIR /app/apps/api
EXPOSE 3001
# Entry is dist/src/main.js — drizzle.config.ts at the app root widens tsc's
# rootDir, so nest build nests the compiled sources one level under dist/.
CMD ["node", "dist/src/main.js"]
