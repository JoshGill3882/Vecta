# Dual-provider DB & migrations

The app runs on **SQLite by default and PostgreSQL when you point it at one** —
from a _single_ Prisma schema. This guide covers how that works and the
migration workflow. For the runtime client and where queries live, see
[Database & service layer](./database.md).

**Key files**

- `prisma/schema.prisma` — one set of models, shared by both providers
- `scripts/db-provider.mjs` — `detectProvider()` + `MIGRATIONS_DIR` (single source of truth)
- `scripts/resolve-provider.mjs` — patches the schema's `provider` line before each Prisma command
- `prisma.config.ts` — selects the migration history + connection URL per command
- `prisma/migrations/{sqlite,postgres}/` — two separate migration histories

## How provider selection works

Prisma can't read the datasource `provider` from an env var, so the project
derives it from the **shape of `DATABASE_URL`** and rewrites the schema before
each command:

```
file:...                         -> sqlite
postgres://... / postgresql://.. -> postgresql   (detectProvider, db-provider.mjs)
```

The `db:*` npm scripts run `node scripts/resolve-provider.mjs` first, which
patches the single `provider = "..."` line in `prisma/schema.prisma` to match.
`prisma.config.ts` then points Prisma at the matching migration directory
(`MIGRATIONS_DIR[provider]`) and injects `DATABASE_URL`.

> **Heads up:** because the script rewrites `schema.prisma`, running a Postgres
> command will show that line changed in `git diff`. The committed default is
> `sqlite`; switch it back (or just run a SQLite command) before committing.

## How to switch to PostgreSQL

1. Set a Postgres URL in `.env`:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/taskmanager?schema=public"
   ```
2. Apply the Postgres migration history:
   ```bash
   npm run db:migrate   # dev
   npm run db:deploy    # production / CI
   ```

Switching back to SQLite is just restoring the `file:` URL. The same models and
service-layer code run unchanged on both.

## How to add or change a model

1. Edit `prisma/schema.prisma`. **Stick to `String`, `Int`, `DateTime`,
   `Boolean`** — no `Json`/`Jsonb` or native UUID types — so one schema compiles
   to both engines. (Enums are stored as `String`; see `Task.status`.)
2. Generate a migration **for each provider** so both histories stay in lockstep:

   ```bash
   # SQLite (default)
   npm run db:migrate -- --name your_change

   # Postgres — point DATABASE_URL at a postgres instance, then:
   npm run db:migrate -- --name your_change
   ```

3. Regenerate the client: `npm run db:generate`.
4. Commit `schema.prisma` with the `provider` line back on `sqlite`, plus **both**
   new migration folders.

## npm scripts

Each runs `resolve-provider.mjs` first, so the provider always matches your
current `DATABASE_URL`:

| Script                | Does                                               |
| --------------------- | -------------------------------------------------- |
| `npm run db:generate` | Generate the Prisma client into `generated/prisma` |
| `npm run db:migrate`  | Create + apply a dev migration                     |
| `npm run db:deploy`   | Apply committed migrations (prod/CI)               |
| `npm run db:studio`   | Open Prisma Studio                                 |
| `npm run db:reset`    | Drop + re-migrate + re-seed                        |
| `npm run db:seed`     | Run `prisma/seed.ts`                               |

## Gotchas

- **Keep the two migration histories in sync.** A model change migrated on only
  one provider will drift. Generate for both, every time.
- **`detectProvider` throws on an unrecognised URL.** It only accepts `file:`
  and `postgres(ql)://`. The DATABASE_URL check is duplicated at runtime in
  `src/server/db.ts`.
- **Provider-less commands** (e.g. `prisma generate` in a Docker build with no
  `DATABASE_URL`) fall back to SQLite via `detectProvider(url, { fallback })`.
