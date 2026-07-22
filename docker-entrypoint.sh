#!/bin/sh
# Container start-up: bring the database up to date, then hand off to the server.
#
# `set -e` aborts on a failed migration rather than starting a server against a
# half-migrated database. The final `exec` replaces this shell with node so that
# node becomes PID 1 and receives SIGTERM from `docker stop` directly — without
# it, the shell would swallow the signal and every stop would wait out Docker's
# ten-second timeout before a kill, which on the SQLite path risks being killed
# mid-write.
set -e

# Prisma cannot read the datasource provider from an env var, so the schema's
# provider line is patched to match DATABASE_URL before the CLI runs. This is
# also what selects the matching migration history (sqlite vs postgres), via
# prisma.config.ts.
echo "Resolving datasource provider from DATABASE_URL..."
node scripts/resolve-provider.mjs

# Invoked through its build entry rather than node_modules/.bin/prisma: that is
# a relative symlink, and relying on it surviving the image copy is needless
# fragility.
echo "Applying migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting server..."
exec node server.js
