# Database & service layer

All database access flows through two things: a **single Prisma client** and a
**service layer**. This guide covers how to add DB-backed features the right
way. For how one schema targets both SQLite and Postgres, see
[Dual-provider DB & migrations](./dual-provider-migrations.md).

**Key files**

- `src/server/db.ts` — the singleton Prisma client
- `src/server/services/*.ts` — the service seam (e.g. `tasks.ts`, `categories.ts`)
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

## The service layer convention

Data access is funnelled through `src/server/services/*`:

```
Server Action / route handler  ->  service (src/server/services)  ->  prisma
```

Components and actions call **services**, not `prisma` directly. The service is
the seam where validation and (per PLAN.md Phase 3) action-boundary logging
live, and it keeps query logic out of UI code.

> **Status:** the service bodies are stubbed until Phase 3 (they
> `throw new Error("not implemented")`) — see [`docs/PLAN.md`](../PLAN.md) §6.
> The **signatures and input types are the contract** callers build against now.

### Service contract reference

`src/server/services/tasks.ts`:

```ts
type TaskStatus = "open" | "in_progress" | "closed";
interface CreateTaskInput { title: string; description?: string; status: TaskStatus; categoryId?: string | null; }
interface UpdateTaskInput { title?: string; description?: string; status?: TaskStatus; categoryId?: string | null; }

getTasks(): Promise<TaskModel[]>
getTaskById(id: string): Promise<TaskModel | null>
createTask(input: CreateTaskInput): Promise<TaskModel>
updateTask(id: string, input: UpdateTaskInput): Promise<TaskModel>
deleteTask(id: string): Promise<void>
```

`src/server/services/categories.ts` mirrors this with
`CreateCategoryInput { name; color? }` / `UpdateCategoryInput` and the matching
`getCategories` / `getCategoryById` / `createCategory` / `updateCategory` /
`deleteCategory`.

## How to add a DB-backed feature

1. **Add/extend a service** under `src/server/services/`. Put the Prisma query
   here, importing `{ prisma }` from `@/src/server/db` and model types from
   `@/generated/prisma/models`.
2. **Call it from a Server Action** (guarded with `requireSession()` — see
   [Authentication](./authentication.md)), or from a Server Component for reads.
3. If the feature needs schema changes, follow
   [Dual-provider DB & migrations](./dual-provider-migrations.md) and regenerate
   the client.

## Gotchas

- **Don't leak `prisma` to the client.** A stray import in a `"use client"` file
  will pull the driver into the browser bundle (or fail the build).
- **Generated code lives in `generated/prisma`** and is produced by
  `npm run db:generate`. Import model types from there, not from `@prisma/client`.
- **Field types are constrained** to `String/Int/DateTime/Boolean` for
  cross-provider parity (no `Json`, no native UUID).
