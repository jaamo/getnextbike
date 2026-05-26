# syntax=docker/dockerfile:1.7

# --- 1. Workspace dependencies ----------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

# Copy workspace manifests for cache-friendly install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/crawler/package.json packages/crawler/
COPY packages/llm/package.json packages/llm/

RUN pnpm install --frozen-lockfile

# --- 2. Build ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages ./packages
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @getnextbike/web build

# --- 3. Runtime (standalone) -------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
