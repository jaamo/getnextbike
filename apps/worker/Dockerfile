# syntax=docker/dockerfile:1.7
#
# Worker container — Playwright base so headless Chromium + system libs are
# preinstalled (spec §11.2). The crawler runs Playwright in-process in v1.

# --- 1. Install deps --------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/crawler/package.json packages/crawler/
COPY packages/llm/package.json packages/llm/

RUN pnpm install --frozen-lockfile

# --- 2. Runtime -------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.49.1-jammy AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /repo/packages ./packages
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/worker apps/worker
COPY packages packages

USER pwuser
ENV WORKER_HEALTH_PORT=3100
EXPOSE 3100

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
