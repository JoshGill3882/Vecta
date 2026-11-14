import "server-only";

import { prepareDetail, scrubUrlCredentials } from "@/src/server/log-detail";
import type { LogLevel } from "@/src/shared/lib/dtos/logs";
import { LOG_LEVELS } from "@/src/shared/lib/schemas/logs";

// The shared server-side logger. Every entry at or above the minimum level goes
// to two places, which are deliberately not equal:
//
// - stdout, as one JSON line. This always works, so it is where the failures
//   most worth seeing still appear when the database is the thing that broke.
// - the Log table, best-effort and in the background. The caller never waits
//   on it and never sees it fail; a failed write is reported on stdout only, so
//   a broken database cannot set off a loop of entries about itself.

/** The minimum level when `LOG_LEVEL` is unset or not a level. */
export const DEFAULT_LOG_LEVEL: LogLevel = "info";

/** Context recorded with an entry, keyed by name. */
export type LogDetail = Record<string, unknown>;

/** Records one entry at a level.
 *
 * @param event A stable machine-readable name, such as `action.unexpected_error`.
 * @param message A human-readable line describing what happened.
 * @param detail Optional context. Sensitive values are hidden before it is written anywhere.
 */
export type LogMethod = (event: string, message: string, detail?: LogDetail) => void;

/** One entry, prepared and ready for both destinations. */
interface PreparedEntry {
  /** How severe it is. */
  level: LogLevel;
  /** Its stable machine-readable name. */
  event: string;
  /** Its human-readable line, with credentials removed. */
  message: string;
  /** Its context, made safe to serialise, or undefined when it has none. */
  detail?: LogDetail;
}

/** Table writes not yet finished, so `flushLogs` can wait for them. */
const pending = new Set<Promise<void>>();

/** The log service, once something has asked for it. */
let logService: Promise<typeof import("@/src/server/services/logs")> | undefined;

/** Whether a value is one of the log levels.
 *
 * @param value Any value, such as the text of `LOG_LEVEL`.
 * @returns True when it names a level.
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return (LOG_LEVELS as readonly unknown[]).includes(value);
}

/** The minimum level, read from `LOG_LEVEL` each time an entry is logged.
 *
 * An invalid value falls back to the default here rather than throwing, so that
 * logging never fails. Start-up refuses an invalid value separately.
 *
 * @returns The configured level, or `DEFAULT_LOG_LEVEL`.
 */
function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL;
  return isLogLevel(configured) ? configured : DEFAULT_LOG_LEVEL;
}

/** Writes one JSON line to stdout.
 *
 * @param line The fields to write. A field that is undefined is left out.
 */
function writeLine(line: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...line })}\n`);
}

/** Prepares an entry's detail, falling back to a note when that fails.
 *
 * Preparation only fails on something unusual, such as a getter that throws,
 * and the logger must not throw because of it.
 *
 * @param detail The context the caller recorded, if any.
 * @returns The prepared detail, a note saying it could not be prepared, or undefined.
 */
function safeDetail(detail: LogDetail | undefined): LogDetail | undefined {
  if (detail === undefined) return undefined;
  try {
    return prepareDetail(detail);
  } catch {
    return { unprepared: "The detail recorded with this entry could not be prepared" };
  }
}

/** Loads the log service the first time a table write needs it.
 *
 * Loading it opens the database, which throws when `DATABASE_URL` is missing,
 * and that must cost the table write alone, never the stdout line or the
 * caller. Every write shares the one load, so a database that cannot be opened
 * is tried once, not again for every entry.
 *
 * @returns The log service, or a rejection explaining why it could not load.
 */
function loadLogService(): Promise<typeof import("@/src/server/services/logs")> {
  logService ??= import("@/src/server/services/logs");
  return logService;
}

/** Writes an entry to the Log table in the background.
 *
 * @param entry The prepared entry.
 */
function writeToTable(entry: PreparedEntry): void {
  const write = loadLogService()
    .then(({ writeLog }) => writeLog({ kind: "operational", ...entry }))
    .then(
      () => undefined,
      (error: unknown) => {
        writeLine({
          level: "error",
          event: "log.write_failed",
          message: "Could not write a log entry to the Log table",
          detail: safeDetail({ entryEvent: entry.event, error }),
        });
      }
    );
  pending.add(write);
  void write.finally(() => pending.delete(write));
}

/** Records an entry at a level, if the level is at or above the minimum.
 *
 * @param level How severe the entry is.
 * @param event Its stable machine-readable name.
 * @param message Its human-readable line.
 * @param detail Optional context.
 */
function log(level: LogLevel, event: string, message: string, detail?: LogDetail): void {
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(minimumLevel())) return;
  const entry: PreparedEntry = {
    level,
    event,
    message: scrubUrlCredentials(message),
    detail: safeDetail(detail),
  };
  writeLine({ ...entry });
  writeToTable(entry);
}

/** The shared server-side logger: one method per level, from least to most severe. */
export const logger: Record<LogLevel, LogMethod> = {
  debug: (event, message, detail) => log("debug", event, message, detail),
  info: (event, message, detail) => log("info", event, message, detail),
  warn: (event, message, detail) => log("warn", event, message, detail),
  error: (event, message, detail) => log("error", event, message, detail),
};

/** Waits for every table write still in progress.
 *
 * Nothing on a request path calls this. It is for tests, and for anything that
 * wants the table up to date before it stops, such as the process exiting.
 *
 * @returns A promise that settles once every pending write has.
 */
export async function flushLogs(): Promise<void> {
  await Promise.all(pending);
}
