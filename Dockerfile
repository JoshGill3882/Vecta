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
# before `next build` compiles it into the bundle.
#
# DATABASE_URL is set here purely to get the build through, and is deliberately
# a throwaway path rather than the real one — no connection is ever opened with
# it and it must not reach the final image. It is needed because `next build`
# evaluates every route module while collecting page data, and src/server/db.ts
# throws at module load when the variable is missing. The real DATABASE_URL is
# supplied at container start.
FROM node:lts-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="file:/tmp/build.db" npm run db:generate && \
    DATABASE_URL="file:/tmp/build.db" npm run build

# ── migrator ─────────────────────────────────────────────────────────────────
# The entrypoint needs the Prisma CLI, which the app never imports, so nothing
# puts it in the standalone output. Copying node_modules/prisma by hand does not
# work either: npm's node_modules layout is flat, so the CLI's transitive deps
# (effect, dotenv, …) sit at the top level rather than nested inside it, and a
# hand-picked copy strands them. Installing into an empty project instead lets
# npm resolve the whole closure. Versions are read from the app's manifest so
# this can never drift from what the build used.
FROM node:lts-alpine AS migrator
WORKDIR /m
COPY package.json ./app-package.json
RUN PRISMA_VERSION="$(node -p "require('./app-package.json').devDependencies.prisma")" && \
    DOTENV_VERSION="$(node -p "require('./app-package.json').dependencies.dotenv")" && \
    rm app-package.json && \
    npm init -y > /dev/null && \
    npm install --no-audit --no-fund \
      "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}"

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:lts-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone's server.js binds to $HOSTNAME, and Docker sets that to the
# container ID — which resolves to the eth0 address only. Published ports still
# work (they arrive on that interface), but nothing listens on loopback, so the
# HEALTHCHECK below cannot reach the app. Binding 0.0.0.0 covers both.
ENV HOSTNAME=0.0.0.0
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
# The Prisma CLI and its full dependency closure, resolved in the migrator
# stage. This merges into the node_modules the standalone output already
# created, so it must come after that copy.
COPY --from=migrator /m/node_modules ./node_modules

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
