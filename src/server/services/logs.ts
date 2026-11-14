import "server-only";

import { prisma } from "@/src/server/db";
import { LogEntryDTO, LogKind, LogLevel, toLogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { LogWriteInput, logWriteSchema } from "@/src/shared/lib/schemas/logs";

// Log service - the only code that reads or writes the Log table. Keeping it to
// one module means every entry is validated, and `detail` is serialised and
// parsed the same way, whoever writes or reads it.

/** The most entries one listing returns, however many are asked for. */
export const MAX_LOG_LIST = 500;

/** How many entries a listing returns when the caller does not say. */
export const DEFAULT_LOG_LIST = 100;

/** Which entries to list, and how many. */
export interface ListLogsOptions {
  /** Only entries of this kind. Omitted lists both. */
  kind?: LogKind;
  /** Only entries at this level. Omitted lists every level. */
  level?: LogLevel;
  /** How many to return, newest first: a whole number from 1 to `MAX_LOG_LIST`. */
  limit?: number;
}

/** Keeps a requested listing size within what one listing may return.
 *
 * A size outside the range is brought into it rather than refused, so a bad
 * value from a page's query string still lists something sensible.
 *
 * @param requested How many entries the caller asked for, if it said.
 * @returns A whole number from 1 to `MAX_LOG_LIST`, or the default when none was given.
 */
function listSize(requested: number | undefined): number {
  if (requested === undefined || Number.isNaN(requested)) return DEFAULT_LOG_LIST;
  return Math.min(Math.max(Math.trunc(requested), 1), MAX_LOG_LIST);
}

/** Writes one log entry.
 *
 * Errors are not caught here: a caller that must never fail because logging
 * did is the one to decide what to do instead.
 *
 * @param input The entry to write.
 * @returns The entry as stored.
 * @throws ZodError when the entry is malformed, TypeError when `detail` cannot
 * be serialised (a circular reference or a BigInt), or the database's error
 * when the write fails.
 */
export async function writeLog(input: LogWriteInput): Promise<LogEntryDTO> {
  const { detail, ...fields } = logWriteSchema.parse(input);
  const row = await prisma.log.create({
    data: { ...fields, detail: detail === undefined ? null : JSON.stringify(detail) },
  });
  return toLogEntryDTO(row);
}

/** Lists log entries, newest first.
 *
 * Entries written in the same millisecond are ordered by id, so a listing is
 * the same every time it is read.
 *
 * @param options Which entries to list, and how many.
 * @returns The matching entries, newest first.
 */
export async function listLogs(options: ListLogsOptions = {}): Promise<LogEntryDTO[]> {
  const rows = await prisma.log.findMany({
    where: { kind: options.kind, level: options.level },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: listSize(options.limit),
  });
  return rows.map(toLogEntryDTO);
}
