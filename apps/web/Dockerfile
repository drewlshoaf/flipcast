FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/server-db/package.json ./packages/server-db/
COPY packages/queue/package.json ./packages/queue/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install

COPY packages/types ./packages/types
COPY packages/server-db ./packages/server-db
COPY packages/queue ./packages/queue
COPY apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "dev"]
