# Environment & boot-time contract

The app **refuses to start** if its required environment variables are missing
or invalid, so misconfiguration fails fast and loudly rather than at the first
request. This guide covers the contract and how to extend it.

## Key files

- `instrumentation.ts` — boot-time validation (`register()`)
- `.env.example` — the documented template
- `src/server/db.ts` — a runtime check for `DATABASE_URL`

## Required variables

| Var              | Required | Rule                                              |
| ---------------- | -------- | ------------------------------------------------- |
| `ADMIN_PASSWORD` | yes      | The single admin password.                        |
| `SESSION_SECRET` | yes      | **≥ 32 characters.** Encrypts the session cookie. |
| `DATABASE_URL`   | yes      | `file:` (SQLite) or `postgres(ql)://` (Postgres). |

Generate a session secret with:

```bash
openssl rand -hex 32
```

Copy `.env.example` to `.env` and fill these in before running the app.

## How boot-time validation works

`instrumentation.ts` exports `register()`, which Next.js runs **once when a
server instance starts, before any request**. Throwing there aborts startup:

- Missing `ADMIN_PASSWORD` → throws.
- Missing `SESSION_SECRET` → throws.
- `SESSION_SECRET` shorter than 32 chars → throws.

It only validates in the **Node.js runtime** (`process.env.NEXT_RUNTIME ===
"nodejs"`); env-based secrets aren't meaningful on the Edge runtime, so it
returns early there.

`DATABASE_URL` is validated separately at module load in `src/server/db.ts`
(and its shape is checked by `detectProvider`), so it fails fast too — on first
DB access if not before.

## How to add a new required env var

1. Add it to `.env.example` with a short comment describing it.
2. Add a check to `register()` in `instrumentation.ts`:
   ```ts
   if (process.env.MY_NEW_VAR == null) {
     throw new Error("MY_NEW_VAR environment variable is required.");
   }
   ```
3. Document it in the table above and, if user-facing, in the root README.

## Gotchas

- **Edge runtime skips validation.** Anything that must hold on Edge needs its
  own guard at point of use.
- **Keep `.env.example` in step with `register()`.** A required var that isn't
  in the example is a trap for the next person setting up.
