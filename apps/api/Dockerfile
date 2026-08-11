FROM node:24-alpine AS development

WORKDIR /app

# Pin pnpm to match your local 9.0.0 version
RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/common/package.json packages/common/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install

COPY packages/common packages/common
COPY apps/api apps/api

RUN pnpm --filter "api..." run build

RUN pnpm --filter "api" run build:migrate
RUN pnpm --filter "api" run build:seed


FROM node:24-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Pin pnpm to match your local 9.0.0 version
RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common/package.json packages/common/package.json
COPY apps/api/package.json apps/api/package.json

# Prevents the native binary verification check from failing in Docker
ENV PNPM_VERIFY_NATIVE_BINARY_LOCKFILE=false

RUN pnpm install --prod --filter "api..."

COPY --from=development /app/apps/api/dist ./apps/api/dist
COPY --from=development /app/apps/api/fonts ./apps/api/fonts
COPY --from=development /app/packages/common/dist ./packages/common/dist

COPY --from=development /app/apps/api/dist-migration ./apps/api/dist-migration
COPY --from=development /app/apps/api/drizzle/migrations ./apps/api/drizzle/migrations

CMD ["node", "apps/api/dist/main"]
