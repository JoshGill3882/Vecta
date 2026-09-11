# Database & service layer

All database access flows through two things: a **single Prisma client** and a
**service layer**. This guide covers how to add DB-backed features the right
way. For how one schema targets both SQLite and Postgres, see
[Dual-provider DB & migrations](./dual-provider-migrations.md).

**Key files**

- `src/server/db.ts` — the singleton Prisma client
- `src/server/services/*.ts` — the service seam (e.g. `tasks.ts`, `categories.ts`)
- `src/server/errors.ts` — domain error types (`NotFoundError`, `ConflictError`)
- `src/lib/dtos/*.ts` — DTO shapes + `toXDTO()` mappers (client-safe, no Prisma client)
- `generated/prisma/*` — the generated client + model types (`npm run db:generate`)

## The Prisma singleton

`src/server/db.ts` exports a single `prisma` instance. Two things to know:

- **It's a singleton cached on `globalThis` in dev.** Next.js hot-reload
  re-evaluates modules on every edit; without the cache each reload would open a
  new connection pool and exhaust the database. Production evaluates once and
  skips the cache.
- **Prisma 7 requires a driver adapter.** The `prisma-client` generator has no
  built-in engine, so `db.ts` selects `PrismaPg` or `PrismaBetterSqlite3` from
  the `DATABASE_URL` shape (reusing `detectProvider`).

Import `prisma` **only** from `db.ts`, and only from server-side code. Never
construct your own `PrismaClient`.

## The server-only boundary

`prisma` (and everything under `src/server/**`) must **never reach a Client
Component bundle**. Keep DB access on the server:

- Call services from Server Components, Server Actions, or route handlers.
- Do not import `db.ts` or a service into a `"use client"` file.
- `src/lib/session.ts` uses the `server-only` package to enforce this at build
  time; apply the same marker if you add new server-only modules.
- **An ESLint rule (`no-restricted-imports` in `eslint.config.mjs`) fails the lint
  if the Prisma client or the `prisma` singleton is imported anywhere outside
  `src/server/**`** (tests and the seed script are exempt). Model _types_ from
`generated/prisma/models` stay allowed — that's how DTOs map rows.

## The service layer convention

Data access is funnelled through `src/server/services/*`:

```text
Server Action / route handler  ->  service (src/server/services)  ->  prisma
```

Components and actions call **services**, not `prisma` directly. A service does
three jobs: run the Prisma query, **map the row to a DTO**, and **translate
Prisma errors into domain errors**. That keeps query logic out of UI code and
keeps callers decoupled from the database schema.

### Service contract reference

`src/server/services/tasks.ts` — every function returns a **DTO** (never a raw
Prisma model), and lookups **throw** rather than return `null`:

```ts
import type { TaskDTO } from "@/src/lib/dtos/tasks";

interface CreateTaskInput { title: string; description?: string; status: TaskStatus; categoryId?: string | null; }
interface UpdateTaskInput { title?: string; description?: string; status?: TaskStatus; categoryId?: string | null; }

getTasks(): Promise<TaskDTO[]>
getTaskById(id: string): Promise<TaskDTO>                          // throws NotFoundError
createTask(input: CreateTaskInput): Promise<TaskDTO>              // throws NotFoundError (bad categoryId)
updateTask(id: string, input: UpdateTaskInput): Promise<TaskDTO> // throws NotFoundError
deleteTask(id: string): Promise<void>                            // throws NotFoundError
```

`src/server/services/categories.ts` mirrors this with
`CreateCategoryInput { name; color? }` / `UpdateCategoryInput`, returning
`CategoryDTO`. Its `createCategory` / `updateCategory` additionally throw
**`ConflictError`** when the unique `name` collides.

## DTOs

Services return **DTOs** — plain, JSON-safe shapes in `src/lib/dtos/` — not Prisma
models, so callers (and the eventual UI / JSON API) never couple to the schema.
The mappers enforce two conversions:

- **`Date` → ISO string.** `createdAt` / `updatedAt` go through `.toISOString()`,
  so a DTO can be handed straight to a Client Component.
- **`status` is narrowed** from the model's plain `string` to the `TaskStatus` union.

DTO files are **client-safe**: they `import type` the model (types erase at
compile time), so importing a `TaskDTO` into a `"use client"` file never drags the
Prisma client into the browser bundle. The mapper lives here too, but only the
server calls it.

```ts
// src/lib/dtos/tasks.ts
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

Services catch the **anticipated** Prisma error codes and re-throw a domain error
from `src/server/errors.ts`. Unanticipated errors (e.g. the DB is unreachable) are
deliberately left to propagate.

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

> **`instanceof` needs matching class identity.** Import
> `PrismaClientKnownRequestError` from `@prisma/client/runtime/client` — the same
> runtime the generated client throws from. A mismatched import silently makes
> every check `false`, and the raw error leaks.

The Server Action layer turns these domain errors into its `{ ok, error }`
response shape; see [Input validation](./validation.md).

### Defensive validation at the seam

Each create/update runs `schema.parse(input)` before touching the DB. The Server
Action is the _primary_ validation gate (it produces friendly `fieldErrors`); the
service `.parse()` is a **second line of defence** for non-action callers (future
REST routes, scripts, seeds). It throws a `ZodError` — a programmer-error signal,
not a user-facing one.

## How to add a DB-backed feature

1. **Add a DTO + mapper** in `src/lib/dtos/` for the shape callers should see
   (`import type` the model so the file stays client-safe).
2. **Add/extend a service** under `src/server/services/`: import `{ prisma }` from
   `@/src/server/db`, run the query, map the row with your `toXDTO()`, and
   translate the anticipated Prisma errors into domain errors (see the table above).
3. **Call it from a Server Action** (guarded with `requireSession()` — see
   [Authentication](./authentication.md)), or from a Server Component for reads.
4. If the feature needs schema changes, follow
   [Dual-provider DB & migrations](./dual-provider-migrations.md) and regenerate
   the client.

## Gotchas

- **Don't leak `prisma` to the client.** A stray import in a `"use client"` file
  will pull the driver into the browser bundle (or fail the build).
- **Generated code lives in `generated/prisma`** and is produced by
  `npm run db:generate`. Import model types from there, not from `@prisma/client`.
- **Field types are constrained** to `String/Int/DateTime/Boolean` for
  cross-provider parity (no `Json`, no native UUID).
