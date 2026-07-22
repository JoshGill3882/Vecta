# ── deps ─────────────────────────────────────────────────────────────────────
# better-sqlite3 is a native module and Alpine is musl, so it compiles from
# source here — hence the toolchain. Keeping the install in its own stage means
# python3/make/g++ never reach the final image. Building it under the target
# platform is also what keeps the binding correct for the multi-arch builds.
FROM node:lts-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ──────────────────────────────────────────────────────────────────
# The Prisma client generates as TypeScript into generated/, so it has to exist
# before `next build` compiles it into the bundle. No DATABASE_URL is set here
# and none should be: resolve-provider.mjs falls back to SQLite, which only
# decides which provider the schema is patched to — no connection is opened.
FROM node:lts-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:lts-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

COPY --from=builder /app/.next/standalone ./
# Standalone omits these two by design, so they must be copied manually.
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migration toolchain
# resolve-provider.mjs rewrites the schema's provider line at start-up,
# so prisma/ is the one directory the app user must be able to write to.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma.config.ts ./
# Nothing in the app imports the Prisma CLI, so standalone's file tracing leaves
# it out — it has to be copied in explicitly for `migrate deploy`. This is the
# whole CLI, which is heavier than it needs to be (it pulls in Studio and unused
# database drivers); measure the image before deciding whether to prune it.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder --chmod=755 /app/docker-entrypoint.sh ./
# Home of the SQLite file and the documented volume mount point. Created owned
# by the app user so writes work when no volume is mounted over it.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Image metadata, last so that a changing revision never invalidates the layers
# above it. CI supplies version/revision per build; the static labels mean a
# plain `docker build` still produces a correctly attributed image.
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/J-L-Dev-Studio/Task-Management-Solution" \
      org.opencontainers.image.title="J&L Task Management Solution" \
      org.opencontainers.image.description="Self-hosted, single-user task management." \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
