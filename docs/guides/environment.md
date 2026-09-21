# Environment & boot-time contract

The app **refuses to start** if its required environment variables are missing or invalid, so misconfiguration fails fast and loudly rather than at the first request.
This guide covers the contract and how to extend it.

## Key files

- `instrumentation.ts` — boot-time validation (`register()`)
- `.env.example` — the documented template
- `src/server/db.ts` — a runtime check for `DATABASE_URL`
- `next.config.ts` — reads `ALLOWED_DEV_ORIGINS` when the dev server starts

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

## Optional variables

| Var                   | Required | Rule                                                           |
| --------------------- | -------- | -------------------------------------------------------------- |
| `ALLOWED_DEV_ORIGINS` | no       | Comma-separated hostnames allowed to reach the **dev** server. |

Nothing validates this one and nothing needs it.
It is absent by default, and absent is a valid configuration — `register()` never sees it, because the list it guards is of variables the app cannot run without.

### `ALLOWED_DEV_ORIGINS`

`next.config.ts` blocks cross-origin requests to the development server unless the origin is listed in `allowedDevOrigins`.
The LAN ranges are committed there (`192.168.*.*`, `10.*.*.*`, `*.local`), which covers working from the home network.
Anything beyond that — a tunnel used to reach the dev server from elsewhere — goes in this variable instead of the config file, so a personal hostname never enters the repository:

```bash
ALLOWED_DEV_ORIGINS="dev.example.com,*.trycloudflare.com"
```

Entries are appended to the committed defaults rather than replacing them.
Surrounding whitespace is trimmed and empty entries are dropped, so a trailing comma is harmless.

Write each entry as a **hostname only** — no scheme, no port, no path.
Only the hostname of the request's `Origin` header is matched, so `https://dev.example.com:3000` is written `dev.example.com`.
Wildcards stand in for whole labels: `*` for exactly one, `**` for one or more and only at the start of a pattern.
`*.example.com` therefore matches `dev.example.com` but not `example.com` itself, and partial labels like `dev-*.example.com` match nothing.
A tunnel whose hostname is regenerated on every run needs the wildcard form.

This is read once, when `next dev` starts.
It has no effect on `next build` or on the production image, and it is not part of the boot-time contract above.

## How boot-time validation works

`instrumentation.ts` exports `register()`, which Next.js runs **once when a server instance starts, before any request**.
Throwing there aborts startup:

- Missing `ADMIN_PASSWORD` → throws.
- Missing `SESSION_SECRET` → throws.
- `SESSION_SECRET` shorter than 32 chars → throws.

It only validates in the **Node.js runtime** (`process.env.NEXT_RUNTIME === "nodejs"`);
env-based secrets aren't meaningful on the Edge runtime, so it returns early there.

`DATABASE_URL` is validated separately at module load in `src/server/db.ts` (and its shape is checked by `detectProvider`), so it fails fast too — on first DB access if not before.

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

- **Edge runtime skips validation.** Anything that must hold on Edge needs its own guard at point of use.
- **Keep `.env.example` in step with `register()`.** A required var that isn't in the example is a trap for the next person setting up.
