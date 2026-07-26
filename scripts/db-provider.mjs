// Shared database-provider detection, used by prisma.config.ts and the
// resolve-provider script. Single source of truth for "which engine does this
// DATABASE_URL point at?" so the schema's provider line and the migrations
// directory always agree. SQLite and Postgres share one set of models; only
// the provider line and the migration history differ between them.

/** Detected provider -> its committed migration history directory. */
export const MIGRATIONS_DIR = {
  sqlite: "prisma/migrations/sqlite",
  postgresql: "prisma/migrations/postgres",
};

/**
 * Determine the Prisma datasource provider from a connection URL.
 *
 * Prisma cannot read `provider` from an env var, so we derive it from the URL
 * shape: `file:` -> SQLite, `postgres(ql)://` -> PostgreSQL.
 *
 * @param {string | undefined} databaseUrl - Value of DATABASE_URL.
 * @param {{ fallback?: "sqlite" | "postgresql" }} [opts] - When the URL is
 *   missing, return `fallback` instead of throwing. Used by prisma.config.ts so
 *   provider-less commands (e.g. `generate` during a Docker build) still load.
 * @returns {"sqlite" | "postgresql"}
 */
export function detectProvider(databaseUrl, opts = {}) {
  if (!databaseUrl) {
    if (opts.fallback) return opts.fallback;
    throw new Error('DATABASE_URL is not set. Set it in .env (default: "file:./data/app.db").');
  }
  if (/^postgres(ql)?:\/\//i.test(databaseUrl)) return "postgresql";
  if (/^file:/i.test(databaseUrl)) return "sqlite";
  throw new Error(
    `Unsupported DATABASE_URL: "${databaseUrl}". ` +
      'Expected a "file:" URL (SQLite) or a "postgres://" / "postgresql://" URL (PostgreSQL).'
  );
}
