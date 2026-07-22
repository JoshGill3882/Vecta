// Development seed script. Populates a freshly migrated database with a small,
// realistic set of categories and tasks so developers have something to look at
// on first run. Run it with `npm run db:seed` (or `prisma db seed`, which also
// fires automatically after `prisma migrate reset`).
//
// Idempotency: every row is written with a fixed `id` via `upsert`, so re-running
// the seed converges on the same state without creating duplicates and without
// deleting rows you created by hand. It is safe to run as often as you like.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient as SqliteClient } from "../generated/prisma-sqlite/client";
import { PrismaClient as PostgresClient } from "../generated/prisma-postgresql/client";
import { detectProvider } from "../scripts/db-provider.mjs";

// the SQLite file path comes from DATABASE_URL; fall back to the project
// default so the seed works out of the box even without a .env file.
const url = process.env.DATABASE_URL ?? "file:./data/app.db";

// Pick the driver adapter from the URL shape, mirroring src/server/db.ts. This
// is a short-lived CLI process, so we build a dedicated client (no globalThis
// singleton) and disconnect when finished.
const prisma =
  detectProvider(url) === "postgresql"
    ? (new PostgresClient({
        adapter: new PrismaPg({ connectionString: url }),
      }) as unknown as SqliteClient)
    : new SqliteClient({ adapter: new PrismaBetterSqlite3({ url }) });

// Fixed ids make every upsert target the same row on re-run.
//
// They are also cuid-shaped, which is not cosmetic: `taskCreateSchema` validates
// `categoryId` with `z.cuid()`, mirroring the `@default(cuid())` on the column.
// Ids the app could never generate are ids the app then refuses to accept — the
// earlier `seed-cat-*` ids made every seeded task fail validation on edit. Seed
// rows have to satisfy the same invariants as real ones.
//
// `z.cuid()` wants a leading `c`, 9+ characters, and no hyphens or underscores;
// entropy isn't checked, so these stay readable and greppable. If the column ever
// moves to `cuid(2)`, the schema must move to `z.cuid2()` in step — the two are
// separate validators, and the mismatch fails the same silent way.
const categories = [
  { id: "cseedcatwork", name: "Work", color: "#6366f1" }, // indigo
  { id: "cseedcatpersonal", name: "Personal", color: "#10b981" }, // emerald
  { id: "cseedcaturgent", name: "Urgent", color: "#ef4444" }, // red
  { id: "cseedcatideas", name: "Ideas", color: "#f59e0b" }, // amber
] as const;

// Tasks spread across all three statuses ("open" | "in_progress" | "closed").
const tasks = [
  {
    id: "cseedtask1",
    title: "Write the project README",
    description: "Cover setup, scripts, and the dual SQLite/Postgres story.",
    status: "open",
    categoryId: "cseedcatwork",
  },
  {
    id: "cseedtask2",
    title: "Wire up the task service layer",
    description: "Replace the stubbed bodies with real Prisma queries.",
    status: "in_progress",
    categoryId: "cseedcatwork",
  },
  {
    id: "cseedtask3",
    title: "Book the dentist",
    description: "",
    status: "open",
    categoryId: "cseedcatpersonal",
  },
  {
    id: "cseedtask4",
    title: "Renew the TLS certificate",
    description: "Production cert expires at the end of the month.",
    status: "in_progress",
    categoryId: "cseedcaturgent",
  },
  {
    id: "cseedtask5",
    title: "Add a dark-mode toggle",
    description: "A nice-to-have once the core flows are done.",
    status: "closed",
    categoryId: "cseedcatideas",
  },
  {
    id: "cseedtask6",
    title: "Set up the development seed script",
    description: "Example data for new contributors.",
    status: "closed",
    categoryId: "cseedcatwork",
  },
] as const;

async function main() {
  console.log(`Seeding database (${detectProvider(url)}: ${url})`);

  // Categories first — tasks reference them by id.
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { name: category.name, color: category.color },
      create: category,
    });
  }

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        status: task.status,
        categoryId: task.categoryId,
      },
      create: task,
    });
  }

  console.log(`Seeded ${categories.length} categories and ${tasks.length} tasks.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
