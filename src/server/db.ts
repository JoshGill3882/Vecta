import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as SqliteClient } from "@/generated/prisma-sqlite/client";
import { PrismaClient as PostgresClient } from "@/generated/prisma-postgresql/client";
import { detectProvider } from "@/scripts/db-provider.mjs";

/**
 * Singleton Prisma client — the single entry point for all database access.
 *
 * Why a singleton: Next.js hot-reload re-evaluates modules on every edit. Without
 * a guard, each reload would construct a fresh PrismaClient (and a new connection
 * pool), quickly exhausting database connections in dev. We cache the instance on
 * `globalThis` so reloads reuse it. In production the module is evaluated once, so
 * the global cache is skipped.
 *
 * Prisma 7 note: the `prisma-client` generator has no built-in engine connection —
 * a driver adapter is REQUIRED on the constructor. We select the adapter from the
 * DATABASE_URL shape so the app is SQLite- and Postgres-safe from day one, reusing
 * the same `detectProvider` helper that picks the schema provider and migration
 * history (scripts/db-provider.mjs). That keeps the runtime adapter in lockstep
 * with the migrations generated for the same URL.
 *
 * IMPORTANT: import this only from server-side code under `src/server/**`. It must
 * never reach a Client Component bundle.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Set it in .env (default: "file:./data/app.db").');
}

type AppPrismaClient = SqliteClient;

// Takes the URL as a parameter rather than closing over it: the guard above
// narrows `url` to a string at module scope, but that narrowing does not reach
// inside a function body, so a captured `url` widens back to `string | undefined`.
function createClient(databaseUrl: string): AppPrismaClient {
  return detectProvider(databaseUrl) === "postgresql"
    ? (new PostgresClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
      }) as unknown as AppPrismaClient)
    : new SqliteClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: AppPrismaClient };
export const prisma = globalForPrisma.prisma ?? createClient(url);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
