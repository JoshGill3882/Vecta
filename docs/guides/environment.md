# Environment & boot-time contract

The app **refuses to start** if its environment variables are missing or invalid, so misconfiguration fails fast and loudly rather than at the first request.
This guide covers the contract and how to extend it.

## Key files

- `instrumentation.ts` — `register()`, which Next.js runs as the server starts
- `src/server/start-up.ts` — `configurationProblem()` and `startUp()`, the checks and the start-up entry
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

| Var                    | Required | Rule                                                                           |
| ---------------------- | -------- | ------------------------------------------------------------------------------ |
| `LOG_LEVEL`            | no       | `debug`, `info`, `warn` or `error`. Unset or empty means `info`.               |
| `TZ`                   | no       | The server's time zone, such as `Europe/London`. Unset in the image means UTC. |
| `ALLOWED_DEV_ORIGINS`  | no       | Comma-separated hostnames allowed to reach the **dev** server.                 |
| `VECTA_BUILD_VERSION`  | no       | Set by the image, not by you. The build's version, logged at start-up.         |
| `VECTA_BUILD_REVISION` | no       | Set by the image, not by you. The build's commit, logged at start-up.          |

Each is absent by default, and absent is a valid configuration.

### `LOG_LEVEL`

The minimum level a server entry needs to be logged, to stdout and to the `Log` table alike.
`debug` records the most and `error` the least.
Activity entries — changes to tasks and categories, and sign-ins — are recorded whatever it is set to.
Unlike the other optional variables it is checked at start-up: a value that is not a level stops the server from starting, so a typo cannot silently change what is logged.
See [Logging](./logging.md#the-minimum-level).

### `TZ`

The time zone the server keeps, as an IANA name such as `Europe/London` or `America/New_York`.
It is read by Node itself rather than by the app, and the app has no time zone setting of its own, so "server time" anywhere in Vecta means this zone.

It decides two things:

- **When old log entries age out.** The nightly run is at 03:00 in this zone; see [Logging](./logging.md#retention).
- **How the Logs page writes dates and times.** It renders on the server, so an entry's time and day, and the Retention card's cut-off and last run, are read in this zone, whichever zone the browser is in.

In the image it is unset, so the server keeps UTC.
Set it in `.env` to have them follow your own clock; Compose passes it through `env_file`.
Node carries its own time zone data, so the image needs nothing installed for it.
Outside Docker, Node takes the machine's own zone when it is unset.

Nothing checks it at start-up: Node reads a name it does not recognise as UTC.

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
It has no effect on `next build` or on the production image, and nothing checks it at start-up.

### `VECTA_BUILD_VERSION` and `VECTA_BUILD_REVISION`

The `Dockerfile` sets these from the `VERSION` and `REVISION` build arguments CI passes, the same values as the image's labels.
A plain `docker build` gives `dev` and `unknown`, and outside Docker they are unset, which the start-up entry also reports as `dev` and `unknown`.
They are named apart from `VECTA_VERSION`, which Compose reads to choose the image tag to pull and the app never sees.

## How boot-time validation works

`instrumentation.ts` exports `register()`, which Next.js runs **once when a server instance starts, before any request**.
Throwing there aborts startup.

`register()` only does anything in the **Node.js runtime** (`process.env.NEXT_RUNTIME === "nodejs"`).
`instrumentation.ts` is also built for the Edge runtime, where env-based secrets are not meaningful and the Node-only logger cannot load, so it imports `src/server/start-up.ts` from inside that check rather than at the top of the file.

`startUp()` asks `configurationProblem()` for the first problem, checked in a fixed order:

1. Missing `ADMIN_PASSWORD`.
2. Missing `SESSION_SECRET`.
3. `SESSION_SECRET` shorter than 32 characters.
4. `LOG_LEVEL` set to something that is not a level.

On a problem, it logs `server.config_invalid` with the problem in `detail.problem`, waits for that entry's table write, and throws the problem as the error, which stops the server.
Otherwise it logs one `server.started` entry with the build's version and revision and the database provider, then starts ageing old entries out of the log: one run straight away, which is not waited for, and one every night after; see [Logging](./logging.md#retention).
Both entries go to stdout, so `docker compose logs` shows why a container will not start even when the database is the thing that is wrong.

The age-out is loaded inside a `try` rather than at the top of `start-up.ts`, because loading it opens the database.
A failure there, such as a missing `DATABASE_URL`, is logged as `log.age_out_failed` and costs the age-out alone: the server still starts.

`DATABASE_URL` is validated separately: its shape by `detectProvider` when the container's entrypoint resolves the provider, and its presence at module load in `src/server/db.ts`, so it fails fast too — on first DB access if not before.
The start-up entry names the provider as `unknown` rather than failing a second time.

## How to add a new required env var

1. Add it to `.env.example` with a short comment describing it.
2. Add a check to `configurationProblem()` in `src/server/start-up.ts`, in the order it should be reported:
   ```ts
   if (env.MY_NEW_VAR == null) {
     return "MY_NEW_VAR environment variable is required.";
   }
   ```
   It returns the problem rather than throwing, so `startUp()` can log it before the server stops.
3. Add a case to `test/server/start-up.test.ts`.
4. Document it in the table above and, if user-facing, in the root README.
5. If its name could hold a secret the app logs, check it is caught by `prepareDetail()`; see [Logging](./logging.md#what-is-never-logged).

## Gotchas

- **Edge runtime skips validation.** Anything that must hold on Edge needs its own guard at point of use.
- **Keep `.env.example` in step with `configurationProblem()`.** A required var that isn't in the example is a trap for the next person setting up.
- **Never put a secret's value in the problem message.** It is logged as `detail.problem`, and redaction goes by key: text under an ordinary key is only stripped of URL credentials, so a secret written into the sentence would be logged as it is.
