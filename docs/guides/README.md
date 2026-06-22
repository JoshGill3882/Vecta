# Developer guides

Integration how-tos for building on the Task Manager codebase. These are
task-oriented ("how do I protect a route?", "how do I add a model?") and assume
you already have the app running — see the root [`README.md`](../../README.md)
for setup and [`docs/PLAN.md`](../PLAN.md) for the feature spec and roadmap.

> **This is Next.js 16 + Prisma 7.** Conventions differ from older versions and
> from most training data: it's **Proxy**, not Middleware; Prisma requires a
> **driver adapter** on the client. See [`AGENTS.md`](../../AGENTS.md).

| Guide                                                          | What it covers                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Authentication & sessions](./authentication.md)               | Protecting pages and Server Actions, the session helper API, the login/logout flow  |
| [Database & service layer](./database.md)                      | The Prisma singleton, the `src/server/services` seam, how to add DB-backed features |
| [Dual-provider DB & migrations](./dual-provider-migrations.md) | Running on SQLite or Postgres from one schema, the migration workflow               |
| [Environment & boot-time contract](./environment.md)           | Required env vars and how the app validates them on startup                         |
| [Rate limiting](./rate-limiting.md)                            | Applying the in-memory attempt limiter to an action                                 |
| [Testing patterns](./testing.md)                               | How the suite mocks Next/iron-session and resets module state                       |
