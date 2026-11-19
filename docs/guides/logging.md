# Logging

The server records what happens through one shared logger.
Every entry goes to **stdout** as a JSON line and to the **`Log` table**, and the two are deliberately not equal:
stdout always works, while the table is best-effort.
This guide covers how to log, the two kinds of entry, what happens to an entry, how the entries are read, exported and purged, how old ones age out of the table, and how to test code that logs.

## Key files

- `src/server/logger.ts` — `logger`, `flushLogs()` and `isLogLevel()`
- `src/server/log-detail.ts` — `prepareDetail()`, which hides secrets and makes detail safe to serialise
- `src/server/changed-fields.ts` — `changedFields()`, which names the fields an update changes
- `src/server/start-up.ts` — the start-up checks, the `server.started` entry, and the start of the nightly age-out
- `src/server/log-retention.ts` — `ageOutLogs()`, `getRetentionStatus()` and the nightly timer
- `src/server/log-export.ts` — `exportStream()` and `exportFileName()`, which write an export as CSV or JSON
- `src/server/log-purge.ts` — `purgeLogs()`, which deletes entries on demand and records that it did
- `app/api/logs/export/route.ts` — the route the Logs page's Export menu downloads from
- `src/server/services/logs.ts` — the log service the logger writes the table through; see [Database & service layer](./database.md#the-log-service)
- `src/server/services/settings.ts` — the settings service, which holds the chosen retention and the last run; see [Database & service layer](./database.md#the-settings-service)
- `src/features/logs/` — the Logs page, which lists the table's entries and holds the Export menu, Purge and the Retention card; see [UI & frontend](./ui.md#the-logs-page)

## Two kinds of entry

- **Operational** entries record what happened on the server: start-up, a configuration problem, an unexpected error.
  They answer "what went wrong".
- **Activity** entries record a change the user made to their data, or a sign-in.
  They answer "what happened to my data, and when".

Both share the same shape, the same destinations and the same redaction.
They differ in one rule: the minimum level drops operational entries, never activity ones.

## Logging an entry

```ts
import { logger } from "@/src/server/logger";

logger.error("action.unexpected_error", "A server action failed unexpectedly", { error });
logger.activity.info("task.deleted", "Task deleted", { taskId, title });
```

`logger.debug`, `info`, `warn` and `error` write operational entries; `logger.activity.debug`, `info`, `warn` and `error` write activity ones.
Each takes three things:

- **An event name**, lowercase words joined by dots, at least two of them (`server.started`, `action.unexpected_error`).
  It is the stable, machine-readable part, so name what happened rather than describing it.
  Activity events take the form `<entity>.<verb>`, such as `task.deleted`.
- **A message**, a human-readable line.
- **Optional detail**, an object of context.
  Pass an `Error` as it is: the logger spells it out as its name, message, stack and cause, which JSON alone would write as `{}`.

The logger never throws and never makes its caller wait.
It is server-only (`import "server-only"`), so it cannot be imported into a Client Component.

### Events the app logs

| Event                     | Kind        | Level   | When                                                                                                                                                                          |
| ------------------------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.started`          | operational | `info`  | Start-up succeeded. `detail` holds `version`, `revision` and `provider`                                                                                                       |
| `server.config_invalid`   | operational | `error` | Start-up found a configuration problem, just before it refuses to start                                                                                                       |
| `action.unexpected_error` | operational | `error` | `toActionError()` met an error that is not a `DomainError`                                                                                                                    |
| `log.write_failed`        | operational | `error` | Writing an entry to the table failed. **stdout only**, never the table                                                                                                        |
| `log.age_out_failed`      | operational | `error` | A start-up or nightly age-out run failed, or the nightly runs could not be started. `detail.error` says why                                                                   |
| `log.export_failed`       | operational | `error` | An export failed partway through. `detail` holds `format` and `error`                                                                                                         |
| `task.created`            | activity    | `info`  | A task was created. `detail` holds `taskId` and `title`                                                                                                                       |
| `task.updated`            | activity    | `info`  | A task was updated. `detail` adds `changed`, the names of the fields that changed                                                                                             |
| `task.deleted`            | activity    | `info`  | A task was deleted. `detail` holds the title it had                                                                                                                           |
| `category.created`        | activity    | `info`  | A category was created. `detail` holds `categoryId` and `name`                                                                                                                |
| `category.updated`        | activity    | `info`  | A category was updated. `detail` adds `changed`                                                                                                                               |
| `category.deleted`        | activity    | `info`  | A category was deleted. `detail` adds `uncategorisedTasks`, how many tasks lost it                                                                                            |
| `auth.signed_in`          | activity    | `info`  | A sign-in succeeded. No detail                                                                                                                                                |
| `auth.sign_in_failed`     | activity    | `warn`  | A sign-in failed. `detail.reason` is `wrong_password` or `rate_limited`, and nothing else                                                                                     |
| `auth.signed_out`         | activity    | `info`  | The user signed out. No detail                                                                                                                                                |
| `log.purged`              | activity    | `warn`  | Log entries were purged from the Logs page. `detail` holds `scope` (`filtered` or `all`), `removed`, and the `search`, `level`, `source` and `range` filters, empty for `all` |

The Logs page files each event under a source by its prefix: `auth.` is Auth, `task.` is Tasks, `category.` is Categories, and anything else is System.
A new event with one of those prefixes is filed with its entity, and any other lands under System with no change needed.

## Recording activity

Activity is recorded in the service layer, in `src/server/services`, where each change is actually made — not in the Server Actions or the UI.
Anything that calls a service is then covered without having to remember to log.

Each service logs straight after its Prisma call succeeds, inside the `try`.
A validation failure or a domain error throws before that line, so a change that did not happen is never recorded;
an unexpected error still reaches `toActionError()` and gets its operational entry.

What an entry holds is chosen so it still makes sense after the row is gone:

- **The id and the title or name at the time.** A delete gets both from the row Prisma returns, so no extra read is needed.
- **For an update, the names of the fields that changed.** The service reads the row and writes it in one `$transaction`, and `changedFields()` compares the two.
  A field counts when the update supplies it and its value differs, so a field sent unchanged is left out, and an update that changes nothing records `changed: []`.
- **For a category delete, how many tasks were uncategorised.** The service counts the category's tasks in the same transaction, just before deleting it.

Two things are left out by design.
**A description's text** is never recorded, only that it changed, so the log does not become a second copy of the user's content.
**A failed sign-in records only its reason** — never the submitted password, its length, or anything derived from it.
`src/server/services/auth.ts` owns sign-in, so that rule lives in one file.

## Where an entry goes

An operational entry below the minimum level is dropped.
Anything else is prepared once and then written twice:

1. **stdout**, as one line: `{"time":"…","kind":"activity","level":"info","event":"…","message":"…","detail":{…}}`.
   `detail` stays nested, so a detail key can never overwrite `time` or `level`, and is left out when there is none.
   This is what `docker compose logs` shows, and it is written before anything touches the database.
2. **The `Log` table**, under the entry's kind, in the background.
   If the write fails, the logger writes an operational `log.write_failed` line to stdout naming the entry's event in `entryEvent`, and carries on.
   It does not retry, and it never writes its own failure to the table, so a broken database cannot set off a loop of entries about itself.

The log service is loaded on the first table write, not when the logger is.
Loading it opens the database, and `src/server/db.ts` throws as it loads when `DATABASE_URL` is missing; that must cost the table write alone.
Every write shares that one load, so a database that cannot be opened is tried once, not again for every entry.

`flushLogs()` waits for table writes still in progress.
A purge calls it, so the page it refreshes shows the purge's own entry.
Start-up calls it before refusing to start, to give the `server.config_invalid` entry its chance to reach the table, and tests call it to wait for writes deterministically.

## Reading the entries

Signed in, the Logs page at `/logs` lists the table's entries, newest first, 50 to a page, and narrows them by a search, a level, a source and a time range.
It shows the table only, so an entry that failed to reach it is on stdout alone, as `log.write_failed` is by design.

The search looks in a row's message as the page words it, its stored message, its event and every value in its detail, ignoring case; the detail's keys are left out, since names such as `title` would match nearly every entry.
It is matched in code, by `entryMatches` in `src/server/log-search.ts`, rather than by the database.
A database's substring match reads `%` and `_` as wildcards, and ignores case for unaccented letters at most, differently on SQLite and Postgres; matched in code, the text is found exactly as typed and case is ignored for every letter, on either engine.
The cost is that a search reads every entry the level, source and range match, which retention keeps within bounds unless it is set to Forever.
The range is the last 24 hours, 7 days or 30 days, as spans of hours, counted back from the moment the page read its counts, so the page, an export and a purge from it cover the same window.

A row's message is written by `entryMessage()` in `src/shared/lib/entry-message.ts`, from the event and its detail rather than the stored message.
A task or category entry names what it was about, such as `Deleted category “Work”`, and a failed sign-in says why.
An event with no wording there, or whose detail lacks what its wording needs, shows its stored message, so a new event reads sensibly without a change to the page; give it wording there when the stored message alone would leave a reader asking what it was about.

Opening a row shows its timestamp, id, kind, event and every detail field, so whatever an entry records is visible on the page.
That is one more reason the rules under [What is never logged](#what-is-never-logged) matter: what reaches the table is what a reader of the page sees, and what an export carries.

## Exporting the entries

The Logs page's Export menu downloads the entries its filters match, newest first, or every entry when no filter is on, as CSV for a spreadsheet or JSON for full detail.
The download is `GET /api/logs/export?format=csv` or `format=json`, with the page's `q`, `level`, `source` and `range` parameters.
The route reads them with `logFiltersSchema`, as the page does, and `logExportHref` in `src/features/logs/lib/log-links.ts` writes the address from the same filters as the page's own, so an export always holds what the page lists.
A `readAt` parameter, an ISO 8601 moment read with `logReadAtSchema`, leaves out entries written after it: Purge's "Export these first" sends the moment the page's counts were read, so its file holds what the purge would delete.
An unreadable `readAt` is ignored, as an unknown filter is, and every match is exported.

- **Both formats hold the same six fields:** `time`, the ISO 8601 timestamp in UTC, then `kind`, `level`, `event`, `message` and `detail`.
  `message` is the stored message, not the page's wording for it.
- **The CSV** has a header row and one row per entry, with CRLF line ends, and starts with a UTF-8 byte order mark so Excel reads it in the right encoding.
  `detail` is one cell of JSON, empty when there is none, since the full set of detail fields is not known until the last row has been written.
  A cell holding a quote, a comma or a line break is quoted.
  A cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets an apostrophe in front, which a spreadsheet reads as text.
  Typed titles and names sit inside the detail's JSON, which starts with `{`, but every cell is guarded, so a field that comes to carry typed text cannot run as a formula on the computer that opens the file.
- **The JSON** is an array with one entry to a line, and `detail` as an object or `null`.
- **It is streamed.** `readLogBatches` in the log service reads the matching entries 500 at a time, and `exportStream` writes each batch only when the download asks for more, so a large log is never held in memory and a stopped download stops the reading.
  With a search on, each batch is searched once it is read, so a batch can hold fewer entries than were read for it.
  Each batch starts after the last entry of the one before rather than at an offset, so an entry written during the export is neither read twice nor included.
- **The file is named by when it was made**, in the server's time zone, such as `vecta-logs-2026-11-17-1930.csv`.
  It is served with `Content-Disposition: attachment`, so the browser saves it without leaving the page, and `Cache-Control: no-store`, so no copy is kept along the way.
- **The route checks the session itself**, since the proxy leaves `/api` alone: a signed-out request gets a 401 and no entries.
  See [Authentication & sessions](./authentication.md#how-to-protect-a-route-handler).

**An export writes no entry**, since it only reads the log, as the Logs page does.
A failure partway through logs `log.export_failed` with the format and the error, and ends the download with an error, so the browser reports it failed rather than saving a file that looks complete.

## Purging entries

The Logs page's Purge button deletes entries on demand, behind a confirmation: either the entries the filters match or every entry.
Deleting entries older than a date is what Retention's Remove now does, so a purge has no date of its own.

- **It deletes what the page counted.** `listLogPage` notes the moment it reads its counts as `readAt`, and the confirmation sends it back.
  `deleteLogs` in the log service then deletes only the matching entries written up to that moment, in one `deleteMany` on the `createdAt` index, so an entry written while the confirmation was open is kept and the number on its button is the number deleted.
  With a search on, the matching entries are found as an export finds them and deleted by id, 500 to a delete, all in one transaction, so a purge that fails partway deletes nothing.
- **Its input is checked strictly.** `purgeLogsAction` validates with `logPurgeSchema`, which uses the same levels, sources and ranges as the page's filters but refuses an unknown one, or a search over 200 characters, rather than clearing it, since clearing it would widen the purge.
  A purge of the filtered entries needs a filter on, a search or a range counting as one, so one recorded as filtered always was.
- **It is always recorded.** `purgeLogs()` in `src/server/log-purge.ts` writes `log.purged` at `warn` after the deletion, as an activity entry so `LOG_LEVEL` never drops it.
  It is written after the moment the purge deletes up to, so it survives the purge it records, and a log emptied by a purge still shows when.
  The purge waits for the entry to reach the table before the page refreshes, so the page shows it.
- **"Export these first"** downloads the chosen entries as JSON, bounded by the same `readAt`, and leaves the confirmation open; see [Exporting the entries](#exporting-the-entries).

A failed purge is reported like any other failed Server Action, as `action.unexpected_error`, with a toast on the page and the confirmation left open.

## Retention

Entries older than a chosen age are deleted from the table on their own, so it does not grow with everything the app has ever done.
stdout is not touched: whatever keeps the container's output decides how long that lasts.

**The choice** is 7 days, 30 days, 90 days, 1 year or Forever, made on the Logs page's Retention card, and defaults to 90 days.
It is held in the `Settings` table rather than an environment variable, so changing it needs no restart and survives one.
`logRetentionDaysSchema` in `src/shared/lib/schemas/settings.ts` lists the choices, with Forever stored as `0`, and the value is checked both when it is set and when it is read.

**A run** is `ageOutLogs()` in `src/server/log-retention.ts`.
It counts the cut-off back from the moment it runs in days of the calendar rather than spans of 24 hours, so the cut-off keeps its time of day across a change of the clocks, and deletes every entry written before it in one `deleteMany`; an entry written exactly at the cut-off is kept.
With Forever chosen it deletes nothing.
Either way it records when it ran and how many entries it removed in the `Settings` row, which is what the card's "Last run removed 12 entries at 03:00 today" reads.

**Runs happen on a timer inside the server**, so nothing outside it, such as cron or a second container, is needed:

- **Once at start-up**, straight after the `server.started` entry, so a night the server was down for is caught up.
  It is not waited for, so start-up carries on while it runs.
- **Every night at 03:00, server time**, which is the time zone of the Node process: in the image that is UTC, unless `TZ` is set; see [Environment & boot-time contract](./environment.md#tz).
  Each night's time is worked out afresh, so a change of the clocks does not move the run off 03:00.
- **On demand**, from the card's Remove now, through `removeOldLogsAction`.

**Retention never adds to the log it trims.**
A successful run writes no entry, and neither does a change of the chosen age, which the card always shows.
A failed start-up or nightly run logs an operational `log.age_out_failed` with the error, and the next night tries again; a failure never stops the timer, the server or a request.
A failed Remove now is reported like any other failed Server Action, as `action.unexpected_error`, with a toast on the page.

A change of the chosen age takes effect at the next run.
Nothing is deleted when it is changed, unless Remove now is pressed.

The deletion can be repeated safely, so two server instances sharing a database can each run their own timer.
The timer is `unref()`'d, so it never holds the process open by itself, and is kept on `globalThis`, so the dev server reloading the module on an edit does not set a second one.

## The minimum level

`LOG_LEVEL` sets it: `debug`, `info`, `warn` or `error`, defaulting to `info`.
`LOG_LEVELS` in `src/shared/lib/schemas/logs.ts` lists them from least to most severe, and an operational entry is kept when its level is at or after the minimum's position.

**Activity entries ignore the minimum level** and are always recorded.
They are the record of what happened to the user's data, and a quieter `LOG_LEVEL` must not erase that history.

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
  logger: { activity: { info: vi.fn() } },
}));
// …
expect(vi.mocked(logger.activity.info)).toHaveBeenCalledWith("task.deleted", "Task deleted", {
  taskId: "t1",
  title: "Write service tests",
});
```

The action and service tests do this, which also keeps their output free of log lines.
Stand in for only the methods the code under test calls.

**Run the real logger** when the test is about what reaches stdout.
Stand in for the log service, capture `process.stdout.write`, and call `flushLogs()` before asserting on table writes:

```ts
vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
  lines.push(String(chunk));
  return true;
});
```

`test/server/logger.test.ts`, `test/server/services/auth.test.ts`, `test/shared/lib/result.test.ts` and `test/server/start-up.test.ts` follow this pattern.
`test/server/logger-no-database.test.ts` makes the log service impossible to load, as a missing `DATABASE_URL` does, and `test/integration/logger.int.test.ts` writes to the real table.

**The nightly timer** is tested in `test/server/log-retention.test.ts` with fake timers (`vi.useFakeTimers({ now })`), stepping through nights with `vi.advanceTimersByTimeAsync`.
Call `stopAgeOutSchedule()` after each test, since the timer lives on `globalThis` and would otherwise carry into the next.
The deletion itself runs against the real table in `test/integration/log-retention.int.test.ts`.

**An export** is tested in three places.
`test/server/log-export.test.ts` hands `exportStream` batches directly and runs the real logger for the failure entry.
`test/app/logs-export-route.test.ts` calls the route with a `NextRequest`, with the session and the log service stood in for.
`test/integration/logs.int.test.ts` runs `readLogBatches` against the real table.

**A purge** is tested in three places too.
`test/integration/log-purge.int.test.ts` runs `purgeLogs` against the real table with the real logger, and checks the `log.purged` entry is in the table by the time it returns.
`test/integration/logs.int.test.ts` covers `deleteLogs` and its bound, and `test/features/logs/actions.test.ts` covers `purgeLogsAction` with the purge stood in for.

**In an integration test**, read entries back with `activityEntries()` from `test/support/activity.ts`.
It waits for pending writes, then returns the activity entries sorted by event name, since entries written in the same millisecond have no reliable order.

## Gotchas

- **The entrypoint's own output is not logged through the logger.** `docker-entrypoint.sh` resolves the provider and applies migrations before Node starts, so its output is plain text on stdout and never reaches the table.
- **The browser's errors stay in the browser.** `app/(app)/error.tsx` and `app/global-error.tsx` report to the browser console, where a server-only logger cannot run.
  Of the server-side errors behind them, a failed Server Action reaches the logger through `toActionError()`; a page that fails while rendering on the server is reported by Next itself, as plain text on stderr, not through the logger.
- **An entry written just before the process exits may not reach the table.** stdout has it either way. Call `flushLogs()` first where the table matters, as start-up does.
- **`changedFields()` compares with `===`.** That suits every column it is used on today, which hold strings or null; a `Date` or other object would always count as changed.
- **Setting `TZ` moves the nightly run**, along with the dates and times on the Logs page, since both are read on the server's clock.
