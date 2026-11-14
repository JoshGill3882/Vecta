# Logging

The server records what happens to it through one shared logger.
Every entry goes to **stdout** as a JSON line and to the **`Log` table**, and the two are deliberately not equal:
stdout always works, while the table is best-effort.
This guide covers how to log, what happens to an entry, and how to test code that logs.

## Key files

- `src/server/logger.ts` — `logger`, `flushLogs()` and `isLogLevel()`
- `src/server/log-detail.ts` — `prepareDetail()`, which hides secrets and makes detail safe to serialise
- `src/server/start-up.ts` — the start-up checks and the `server.started` entry
- `src/server/services/logs.ts` — the log service the logger writes the table through; see [Database & service layer](./database.md#the-log-service)

## Logging an entry

```ts
import { logger } from "@/src/server/logger";

logger.error("action.unexpected_error", "A server action failed unexpectedly", { error });
```

Each of `logger.debug`, `info`, `warn` and `error` takes three things:

- **An event name**, lowercase words joined by dots, at least two of them (`server.started`, `action.unexpected_error`).
  It is the stable, machine-readable part, so name what happened rather than describing it.
- **A message**, a human-readable line.
- **Optional detail**, an object of context.
  Pass an `Error` as it is: the logger spells it out as its name, message, stack and cause, which JSON alone would write as `{}`.

The logger never throws and never makes its caller wait.
It is server-only (`import "server-only"`), so it cannot be imported into a Client Component.

### Events the app logs

| Event                     | Level   | When                                                                    |
| ------------------------- | ------- | ----------------------------------------------------------------------- |
| `server.started`          | `info`  | Start-up succeeded. `detail` holds `version`, `revision` and `provider` |
| `server.config_invalid`   | `error` | Start-up found a configuration problem, just before it refuses to start |
| `action.unexpected_error` | `error` | `toActionError()` met an error that is not a `DomainError`              |
| `log.write_failed`        | `error` | Writing an entry to the table failed. **stdout only**, never the table  |

## Where an entry goes

An entry below the minimum level is dropped.
Anything else is prepared once and then written twice:

1. **stdout**, as one line: `{"time":"…","level":"error","event":"…","message":"…","detail":{…}}`.
   `detail` stays nested, so a detail key can never overwrite `time` or `level`, and is left out when there is none.
   This is what `docker compose logs` shows, and it is written before anything touches the database.
2. **The `Log` table**, as an `operational` entry, in the background.
   If the write fails, the logger writes a `log.write_failed` line to stdout naming the entry's event in `entryEvent`, and carries on.
   It does not retry, and it never writes its own failure to the table, so a broken database cannot set off a loop of entries about itself.

The log service is loaded on the first table write, not when the logger is.
Loading it opens the database, and `src/server/db.ts` throws as it loads when `DATABASE_URL` is missing; that must cost the table write alone.
Every write shares that one load, so a database that cannot be opened is tried once, not again for every entry.

`flushLogs()` waits for table writes still in progress.
Nothing on a request path calls it.
Start-up calls it before refusing to start, to give the `server.config_invalid` entry its chance to reach the table, and tests call it to wait for writes deterministically.

## The minimum level

`LOG_LEVEL` sets it: `debug`, `info`, `warn` or `error`, defaulting to `info`.
`LOG_LEVELS` in `src/shared/lib/schemas/logs.ts` lists them from least to most severe, and an entry is kept when its level is at or after the minimum's position.

The logger reads `LOG_LEVEL` each time it logs, and reads an invalid value as `info` rather than throwing.
Start-up refuses an invalid value separately, so a typo stops the server from starting instead of being quietly ignored; see [Environment & boot-time contract](./environment.md).
An empty value counts as unset, since Compose passes an unset variable through as `""`.

## What is never logged

`prepareDetail()` runs on every entry's detail before either destination sees it, and returns a copy, leaving the caller's object untouched.

- **Sensitive keys** have their whole value replaced with `"[redacted]"`, however deeply nested and whatever the value is.
  Keys are compared ignoring case, `_` and `-`.
  The list is short and explicit: any key ending in `password`, `sessionSecret`, `session`, `cookie`, `cookies` and `setCookie`.
  A key is added because the app holds a value under that name, not on the chance that something might, so near-misses such as `passwordHint` or `sessionCount` stay visible.
- **Credentials in URLs** are removed from every string in the detail and from the message: `postgresql://vecta:secret@db:5432/vecta` becomes `postgresql://[redacted]@db:5432/vecta`.
  This covers `DATABASE_URL` wherever it turns up, including inside an error's message or stack, while keeping the host for diagnosis.
- **Values JSON cannot hold** are made safe: a loop of objects becomes `"[circular]"` where it closes, and a `BigInt` becomes its digits.

Redaction belongs to the logger rather than to each caller, so a new call site cannot forget it.
Even so, do not put a secret in an event name, which is not redacted.

## Testing code that logs

**Stand in for the logger** when the test is about something else, and check the call:

```ts
vi.mock("@/src/server/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// …
expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
  "action.unexpected_error",
  expect.any(String),
  { error }
);
```

The action tests do this, which also keeps their output free of log lines.

**Run the real logger** when the test is about what reaches stdout.
Stand in for the log service, capture `process.stdout.write`, and call `flushLogs()` before asserting on table writes:

```ts
vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
  lines.push(String(chunk));
  return true;
});
```

`test/server/logger.test.ts`, `test/shared/lib/result.test.ts` and `test/server/start-up.test.ts` follow this pattern.
`test/server/logger-no-database.test.ts` makes the log service impossible to load, as a missing `DATABASE_URL` does, and `test/integration/logger.int.test.ts` writes to the real table.

## Gotchas

- **The entrypoint's own output is not logged through the logger.** `docker-entrypoint.sh` resolves the provider and applies migrations before Node starts, so its output is plain text on stdout and never reaches the table.
- **The browser's errors stay in the browser.** `app/(app)/error.tsx` and `app/global-error.tsx` report to the browser console, where a server-only logger cannot run.
  Of the server-side errors behind them, a failed Server Action reaches the logger through `toActionError()`; a page that fails while rendering on the server is reported by Next itself, as plain text on stderr, not through the logger.
- **An entry written just before the process exits may not reach the table.** stdout has it either way. Call `flushLogs()` first where the table matters, as start-up does.
