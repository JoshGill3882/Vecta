import { beforeAll, beforeEach, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// ── Real DB, mocked runtime edges ───────────────────────────────────────────
// Integration tests drive the genuine stack: action → validate() → service →
// Prisma → in-memory SQLite. Only the Next-runtime-only collaborators are faked,
// because they can't run outside a request: auth (`getSession`, which pulls in
// server-only/iron-session/next/headers) and the cache primitive (`updateTag`).
// The database and the service layer are the real thing.
vi.mock("@/src/lib/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: true })),
}));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

import { prisma } from "@/src/server/db";

// Safety rail: the reset below wipes every row, so refuse to run against anything
// that isn't the in-memory database. This can never nuke a real dev/prod file.
const url = process.env.DATABASE_URL ?? "";
if (!url.includes(":memory:")) {
  throw new Error(
    `Integration tests require an in-memory DATABASE_URL (got "${url}"). ` +
      "Refusing to run so a real database is never wiped."
  );
}

// Build the schema by replaying the committed SQLite migration SQL through the
// app's own connection. `prisma migrate deploy` can't be used here: it runs in a
// separate process, so it would create (and discard) its own in-memory DB rather
// than populating the one the tests connect to. Replaying the real migration
// files gives the identical schema without that cross-process problem.
function migrationStatements(): string[] {
  const dir = fileURLToPath(new URL("../../prisma/migrations/sqlite", import.meta.url));
  const migrations = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // Prisma's timestamp prefix makes lexical order == chronological
  const sql = migrations
    .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
    .join("\n");
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--")) // drop `-- CreateTable` comments
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Apply once per worker process. Vitest may reuse a worker across files, and the
// `db.ts` singleton caches the client on globalThis, so guard against re-creating
// tables that already exist.
const g = globalThis as unknown as { __schemaApplied?: boolean };

beforeAll(async () => {
  if (g.__schemaApplied) return;
  // SQLite only enforces foreign keys when this is ON — required for the FK
  // violation (P2003) and the onDelete: SetNull cascade to behave.
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const stmt of migrationStatements()) {
    await prisma.$executeRawUnsafe(stmt);
  }
  g.__schemaApplied = true;
});

// Clean slate before every test (not just every suite): two tests in one file
// pollute each other exactly as easily as two files do. FK-safe order — tasks
// reference categories.
beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
});
