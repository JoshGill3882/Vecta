# Database & service layer

All database access flows through two things: a **single Prisma client** and a **service layer**.
This guide covers how to add DB-backed features the right way.
For how one schema targets both SQLite and Postgres, see [Dual-provider DB & migrations](./dual-provider-migrations.md).

## Key files

- `src/server/db.ts` — the singleton Prisma client
- `src/server/services/*.ts` — the service seam (`tasks.ts`, `categories.ts`, `logs.ts`, `settings.ts`, and `auth.ts`, which signs in and out)
- `src/server/changed-fields.ts` — `changedFields()`, which an update's activity entry uses to name what changed
- `src/server/errors.ts` — domain error types (`NotFoundError`, `ConflictError`)
- `src/shared/lib/dtos/*.ts` — DTO shapes + `toXDTO()` mappers (client-safe, no Prisma client)
- `generated/prisma/*` — the generated client + model types (`npm run db:generate`)

## The Prisma singleton

`src/server/db.ts` exports a single `prisma` instance.
Two things to know:

- **It's a singleton cached on `globalThis` in dev.** Next.js hot-reload re-evaluates modules on every edit;
  without the cache each reload would open a new connection pool and exhaust the database.
  Production evaluates once and skips the cache.
- **Prisma 7 requires a driver adapter.** The `prisma-client` generator has no built-in engine, so `db.ts` selects `PrismaPg` or `PrismaBetterSqlite3` from the `DATABASE_URL` shape (reusing `detectProvider`).

Import `prisma` **only** from `db.ts`, and only from server-side code.
Never construct your own `PrismaClient`.

## The server-only boundary

`prisma` (and everything under `src/server/**`) must **never reach a Client Component bundle**.
Keep DB access on the server:

- Call services from Server Components, Server Actions, or route handlers.
- Do not import `db.ts` or a service into a `"use client"` file.
- `src/shared/lib/session.ts`, `src/server/logger.ts`, `src/server/log-retention.ts`, `src/server/log-export.ts` and the `logs`, `settings` and `auth` services use the `server-only` package to enforce this at build time;
  apply the same marker if you add new server-only modules.
- **An ESLint rule (`no-restricted-imports` in `eslint.config.mjs`) fails the lint if the Prisma client or the `prisma` singleton is imported anywhere outside `src/server/**`** (tests and the seed script are exempt).
Model _types_ from `generated/prisma/models` stay allowed — that's how DTOs map rows.

## The service layer convention

Data access is funnelled through `src/server/services/*`:

```text
Server Action / route handler  ->  service (src/server/services)  ->  prisma
```

Components and actions call **services**, not `prisma` directly.
A service does four jobs:
run the Prisma query, **map the row to a DTO**, **translate Prisma errors into domain errors**, and **record each change it makes as an activity entry**.
That keeps query logic out of UI code and keeps callers decoupled from the database schema.

### Service contract reference

`src/server/services/tasks.ts` — every function returns a **DTO** (never a raw Prisma model), and lookups **throw** rather than return `null`:

```ts
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

interface CreateTaskInput { title: string; description?: string; status: TaskStatus; categoryId?: string | null; dueAt?: string | null; }
interface UpdateTaskInput { title?: string; description?: string; status?: TaskStatus; categoryId?: string | null; dueAt?: string | null; }

getTasks(): Promise<TaskDTO[]>
getTaskById(id: string): Promise<TaskDTO>                          // throws NotFoundError
createTask(input: CreateTaskInput): Promise<TaskDTO>              // throws NotFoundError (bad categoryId)
updateTask(id: string, input: UpdateTaskInput): Promise<TaskDTO> // throws NotFoundError
deleteTask(id: string): Promise<void>                            // throws NotFoundError
```

`src/server/services/categories.ts` mirrors this with `CreateCategoryInput { name; color? }` / `UpdateCategoryInput`, returning `CategoryDTO`.
Its `createCategory` / `updateCategory` additionally throw **`ConflictError`** when the unique `name` collides.

### Recording activity

Each create, update and delete logs an activity entry through `logger.activity`, straight after the Prisma call succeeds and inside the `try`.
A Zod failure or a translated domain error throws before that line, so a change that did not happen is never recorded.
Recording it here rather than in the actions means any caller of a service is covered.

Two of them need more than the one query, and run their queries as an array `prisma.$transaction([...])`, which works on both engines:

- **An update** reads the row with `findUniqueOrThrow` and then writes it, so `changedFields()` can compare the two.
  A missing row fails the read with the same `P2025` the update would have thrown, so the error translation is unchanged.
- **A category delete** counts the category's tasks and then deletes it, so the entry can say how many tasks `onDelete: SetNull` uncategorised.

A delete names what it removed from the row Prisma returns, with no extra read.
What each entry holds, and what it deliberately leaves out, is in [Logging](./logging.md#recording-activity).

### The log service

`src/server/services/logs.ts` reads and writes the `Log` table, which holds both **operational** entries (what happened on the server) and **activity** entries (what the user did to their data):

```ts
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";

writeLog(input: LogWriteInput): Promise<LogEntryDTO>             // throws ZodError, TypeError, or the DB's error
listLogs(options?: { kind?; level?; limit? }): Promise<LogEntryDTO[]> // newest first
listLogPage(filters: LogFilters): Promise<LogPage>               // one page of the Logs page, with its counts
readLogBatches(filters, batchSize?): AsyncGenerator<LogEntryDTO[]> // every match, newest first, a batch at a time
deleteLogsBefore(cutoff: Date): Promise<number>                  // how many entries were deleted
countLogsBefore(cutoff: Date): Promise<number>                   // how many deleteLogsBefore would delete
```

It is the **only** code that touches `prisma.log`, and a second ESLint rule (`no-restricted-syntax`) fails the lint anywhere else, tests excepted.
Two things make that worth enforcing:

- **Every entry is validated on write** against `logWriteSchema`: a known `kind` and `level`, an `event` of lowercase dotted words such as `task.deleted`, a non-empty message, and `detail` as an object.
- **`detail` is stored as JSON text**, because the schema has no `Json` column.
  It is serialised in `writeLog` and parsed in `toLogEntryDTO`, so there is one place each way.

Unlike the other services, `writeLog` has no Prisma error to translate, records no activity of its own, and catches nothing:
a caller that must not fail because logging did is the one to decide what to do instead.
Application code logs through the shared logger rather than calling `writeLog` itself; the logger prepares and redacts each entry, writes it to stdout, and only then calls `writeLog`, in the background, reporting a failure on stdout. See [Logging](./logging.md).
`listLogs` returns at most `MAX_LOG_LIST` (500) entries, `DEFAULT_LOG_LIST` (100) when no limit is given, and clamps an out-of-range limit into range rather than refusing it.
Entries written in the same millisecond are ordered by id, so a listing reads the same every time.

`listLogPage` is what the Logs page reads.
It takes the filters `logFiltersSchema` reads from the page's URL and returns a `LogPage`: up to `LOG_PAGE_SIZE` (50) entries, newest first, with which page they are and how many pages there are, how many entries match and how many there are in all, when the oldest was written, and how many entries each level and each source holds.
The counts for each level and source ignore the filters, so a filter menu still shows what ticking another choice would add.
The counts are read before the entries, so a page past the last can be read as the last rather than coming back empty.

`readLogBatches` is what an export reads.
It is an async generator that yields the entries the page's levels and sources match, newest first, `LOG_BATCH_SIZE` (500) at a time, ignoring any page, and reads the next batch only when its caller asks for it.
Each batch asks for the entries after the last one read, older or as old with a lower id, rather than skipping an offset.
An entry written while it runs therefore cannot push one already read into the next batch, and anything written after the first batch is left out.
How the batches become a file is in [Logging](./logging.md#exporting-the-entries).

A source is not a column.
It is read from the event's prefix by `SOURCE_PREFIXES` in `src/shared/lib/dtos/logs.ts` (`auth.`, `task.` and `category.`, with every other event under System), so every entry has one however old it is, and the source filter matches on the same prefixes.

`deleteLogsBefore` and `countLogsBefore` are what retention uses: one deletes, and the other counts, every entry written strictly before a moment, as one query on the `createdAt` index.
An entry written exactly at the moment is kept and not counted, so the count the Logs page shows is what Remove now then removes.
Deleting again deletes nothing more, so two servers sharing a database can both run it.
Neither records activity: what a run removed is recorded in the settings instead. See [Logging](./logging.md#retention).

### The settings service

`src/server/services/settings.ts` reads and writes the `Settings` table, which holds the app-wide settings that are chosen in the app rather than in the environment, so changing one needs no restart and survives one:

```ts
import type { SettingsDTO } from "@/src/shared/lib/dtos/settings";

getSettings(): Promise<SettingsDTO>                              // the defaults for anything never saved
setLogRetention(days: LogRetentionDays): Promise<SettingsDTO>    // throws ZodError for a value not offered
recordAgeOut(ranAt: Date, removed: number): Promise<void>        // the last age-out run
```

**The table holds one row, with `id` 1**, as typed columns rather than a key and a value, so every setting has its own type and default in the schema.
The row is created by an `upsert` the first time anything is saved, and a read with no row yet returns the defaults, so a fresh database needs no seeding.

**Each write sets only its own columns.**
A change of retention and an age-out run finishing at the same moment therefore both stick, where writing the whole row would let one undo the other.

**The retention is checked both ways.**
`setLogRetention` parses the value against `logRetentionDaysSchema` before writing, and `toSettingsDTO` reads a stored value that is not one of the choices as the default, 90 days, so a row edited by hand cannot stop the Logs page from showing.

Like the log service, it records no activity: a change of retention writes no log entry, since the Logs page always shows the current choice.

## DTOs

Services return **DTOs** — plain, JSON-safe shapes in `src/shared/lib/dtos/` — not Prisma models, so callers (and the eventual UI / JSON API) never couple to the schema.
The mappers enforce these conversions:

- **`Date` → ISO string.** `createdAt` / `updatedAt` go through `.toISOString()`, so a DTO can be handed straight to a Client Component.
- **String columns holding a fixed set of values are narrowed** to their union: a task's `status` to `TaskStatus`, a log entry's `kind` and `level` to `LogKind` and `LogLevel`.
- **A log entry's `source` is derived** from its event name by `sourceOf`, since it is not stored.
- **A log entry's `detail` is parsed** from JSON text back into an object.
  Stored text that is not a JSON object comes back as `{ unparsed: <the text> }` rather than throwing, so one damaged row cannot stop a listing.

DTO files are **client-safe**:
they `import type` the model (types erase at compile time), so importing a `TaskDTO` into a `"use client"` file never drags the Prisma client into the browser bundle.
The mapper lives here too, but only the server calls it.

```ts
// src/shared/lib/dtos/tasks.ts
export interface TaskDTO {
  id: string;
  title: string;
  /* ... */ createdAt: string;
  updatedAt: string;
}
export function toTaskDTO(model: TaskModel): TaskDTO {
  /* maps fields + .toISOString() */
}
```

## Error handling — never leak Prisma errors

Services catch the **anticipated** Prisma error codes and re-throw a domain error from `src/server/errors.ts`.
Unanticipated errors (e.g. the DB is unreachable) are deliberately left to propagate.

| Prisma code | Cause                                                        | Thrown as                      |
| ----------- | ------------------------------------------------------------ | ------------------------------ |
| `P2025`     | record not found (`update` / `delete` / `findUniqueOrThrow`) | `NotFoundError`                |
| `P2002`     | unique constraint (duplicate category `name`)                | `ConflictError`                |
| `P2003`     | FK constraint (`categoryId` references no category)          | `NotFoundError("Category", …)` |

```ts
try {
  const row = await prisma.task.update({ where: { id }, data });
  return toTaskDTO(row);
} catch (e) {
  if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
    throw new NotFoundError("Task", id);
  }
  throw e; // unknown → let it surface
}
```

> **`instanceof` needs matching class identity.** Import `PrismaClientKnownRequestError` from `@prisma/client/runtime/client` — the same runtime the generated client throws from.
> A mismatched import silently makes every check `false`, and the raw error leaks.

The Server Action layer turns these domain errors into its `{ ok, error }` response shape;
see [Input validation](./validation.md).

### Defensive validation at the seam

Each create/update runs `schema.parse(input)` before touching the DB.
The Server Action is the _primary_ validation gate (it produces friendly `fieldErrors`);
the service `.parse()` is a **second line of defence** for non-action callers (future REST routes, scripts, seeds).
It throws a `ZodError` — a programmer-error signal, not a user-facing one.
Nothing passes user input to `writeLog` directly, so its `.parse()` is the only check an entry gets.

## How to add a DB-backed feature

1. **Add a DTO + mapper** in `src/shared/lib/dtos/` for the shape callers should see (`import type` the model so the file stays client-safe).
2. **Add/extend a service** under `src/server/services/`:
   import `{ prisma }` from `@/src/server/db`, run the query, map the row with your `toXDTO()`, and translate the anticipated Prisma errors into domain errors (see the table above).
   If it changes the user's data, record each change as activity once it has succeeded (see [Recording activity](#recording-activity)).
3. **Call it from a Server Action** (guarded with `requireSession()` — see [Authentication](./authentication.md)), or from a Server Component for reads.
4. If the feature needs schema changes, follow [Dual-provider DB & migrations](./dual-provider-migrations.md) and regenerate the client.

## Gotchas

- **Don't leak `prisma` to the client.** A stray import in a `"use client"` file will pull the driver into the browser bundle (or fail the build).
- **Generated code lives in `generated/prisma`** and is produced by `npm run db:generate`.
  Import model types from there, not from `@prisma/client`.
- **Field types are constrained** to `String/Int/DateTime/Boolean` for cross-provider parity (no `Json`, no native UUID).
  Structured data goes in a `String` column as JSON text, serialised and parsed in one service, as the log's `detail` is.
