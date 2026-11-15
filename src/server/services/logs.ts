import "server-only";

import type { LogWhereInput } from "@/generated/prisma-sqlite/models";
import { prisma } from "@/src/server/db";
import {
  LogEntryDTO,
  LogKind,
  LogLevel,
  LogSource,
  SOURCE_PREFIXES,
  toLogEntryDTO,
} from "@/src/shared/lib/dtos/logs";
import {
  LOG_LEVELS,
  LogFilters,
  LogWriteInput,
  logWriteSchema,
} from "@/src/shared/lib/schemas/logs";

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

/** How many entries one page of the Logs page shows. */
export const LOG_PAGE_SIZE = 50;

/** One page of the log, with the counts the Logs page shows around it. */
export interface LogPage {
  /** The page's entries, newest first. */
  entries: LogEntryDTO[];
  /** Which page this is, from 1. A page past the last shows the last instead. */
  page: number;
  /** How many pages the matching entries fill: at least 1, even when none match. */
  pageCount: number;
  /** How many entries the filters match. */
  matching: number;
  /** How many entries there are, whatever the filters. */
  total: number;
  /** When the oldest entry was written, as an ISO 8601 timestamp, or null when there are none. */
  oldest: string | null;
  /** How many entries there are at each level, whatever the filters. */
  levelCounts: Record<LogLevel, number>;
  /** How many entries there are from each source, whatever the filters. */
  sourceCounts: Record<LogSource, number>;
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

/** Matches the entries from one source.
 *
 * System is matched by what it is not: any event that no other source's prefix
 * starts. SQLite compares prefixes ignoring case, but the write schema keeps
 * event names lowercase, so both engines match the same entries.
 *
 * @param source The source to match.
 * @returns A filter for its entries.
 */
function sourceWhere(source: LogSource): LogWhereInput {
  if (source === "system") {
    return {
      NOT: Object.values(SOURCE_PREFIXES).map((prefix) => ({ event: { startsWith: prefix } })),
    };
  }
  return { event: { startsWith: SOURCE_PREFIXES[source] } };
}

/** Matches the entries the Logs page's filters pick.
 *
 * Choices within one filter widen it, and the two filters narrow each other:
 * Warning and Error from Auth is every warning or error from Auth.
 *
 * @param filters The page's filters. An empty one matches every entry.
 * @returns A filter for the matching entries.
 */
function filtersWhere(filters: LogFilters): LogWhereInput {
  const where: LogWhereInput = {};
  if (filters.level.length > 0) where.level = { in: filters.level };
  if (filters.source.length > 0) where.OR = filters.source.map(sourceWhere);
  return where;
}

/** Lists one page of the entries the Logs page's filters match, newest first.
 *
 * The counts come first, so a page past the last can show the last instead of
 * nothing. Entries written in the same millisecond are ordered by id, so a
 * page holds the same entries every time it is read.
 *
 * @param filters The page's filters and the page asked for.
 * @returns The page's entries, with the counts the page shows around them.
 */
export async function listLogPage(filters: LogFilters): Promise<LogPage> {
  const where = filtersWhere(filters);
  const [matching, total, oldest, levels, auth, tasks, categories] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.count(),
    prisma.log.findFirst({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { createdAt: true },
    }),
    prisma.log.groupBy({ by: ["level"], _count: { _all: true } }),
    prisma.log.count({ where: sourceWhere("auth") }),
    prisma.log.count({ where: sourceWhere("tasks") }),
    prisma.log.count({ where: sourceWhere("categories") }),
  ]);

  const pageCount = Math.max(1, Math.ceil(matching / LOG_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await prisma.log.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * LOG_PAGE_SIZE,
    take: LOG_PAGE_SIZE,
  });

  // Every level starts at zero, so one with no entries still has a count to show.
  const levelCounts = Object.fromEntries(LOG_LEVELS.map((level) => [level, 0])) as Record<
    LogLevel,
    number
  >;
  for (const group of levels) levelCounts[group.level as LogLevel] = group._count._all;

  return {
    entries: rows.map(toLogEntryDTO),
    page,
    pageCount,
    matching,
    total,
    oldest: oldest ? oldest.createdAt.toISOString() : null,
    levelCounts,
    sourceCounts: { auth, tasks, categories, system: total - auth - tasks - categories },
  };
}
