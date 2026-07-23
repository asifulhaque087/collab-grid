FROM node:alpine AS development

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/common/package.json packages/common/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install

COPY packages/common packages/common
COPY apps/api apps/api

RUN pnpm --filter "api..." run build

RUN pnpm --filter "api" run build:migrate
RUN pnpm --filter "api" run build:seed


FROM node:alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common/package.json packages/common/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --prod --filter "api..."

COPY --from=development /app/apps/api/dist ./apps/api/dist
COPY --from=development /app/apps/api/fonts ./apps/api/fonts
COPY --from=development /app/packages/common/dist ./packages/common/dist

COPY --from=development /app/apps/api/dist-migration ./apps/api/dist-migration
COPY --from=development /app/apps/api/drizzle/migrations ./apps/api/drizzle/migrations

CMD ["node", "apps/api/dist/main"]
