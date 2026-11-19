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
  LOG_PAGE_SIZE,
  LogFilters,
  LogNarrowing,
  LogWriteInput,
  RANGE_SPANS,
  logWriteSchema,
} from "@/src/shared/lib/schemas/logs";
import { normaliseQuery } from "@/src/shared/lib/text-search";
import { entryMatches } from "@/src/server/log-search";

// Log service - the only code that reads or writes the Log table. Keeping it to
// one module means every entry is validated, and `detail` is serialised and
// parsed the same way, whoever writes or reads it.

/** The most entries one listing returns, however many are asked for. */
export const MAX_LOG_LIST = 500;

/** How many entries a listing returns when the caller does not say. */
export const DEFAULT_LOG_LIST = 100;

/** How many entries `readLogBatches` reads at a time, unless the caller says. */
export const LOG_BATCH_SIZE = 500;

/** Which entries to list, and how many. */
export interface ListLogsOptions {
  /** Only entries of this kind. Omitted lists both. */
  kind?: LogKind;
  /** Only entries at this level. Omitted lists every level. */
  level?: LogLevel;
  /** How many to return, newest first: a whole number from 1 to `MAX_LOG_LIST`. */
  limit?: number;
}

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
  /** When the counts were read, as an ISO 8601 timestamp.
   *
   * A purge confirmed from the page deletes only entries written up to then,
   * so it deletes what the page counted.
   */
  readAt: string;
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

/** Matches the entries the Logs page's level, source and range pick.
 *
 * Choices within one filter widen it, and the filters narrow each other:
 * Warning and Error from Auth is every warning or error from Auth. The search
 * is not matched here but by `entryMatches`, once the entries are read.
 *
 * @param filters The page's filters. One that is off matches every entry.
 * @param now The moment a range reaches back from.
 * @returns A filter for the matching entries.
 */
function filtersWhere(filters: LogNarrowing, now: Date): LogWhereInput {
  const where: LogWhereInput = {};
  if (filters.level.length > 0) where.level = { in: filters.level };
  if (filters.source.length > 0) where.OR = filters.source.map(sourceWhere);
  if (filters.range !== null) {
    where.createdAt = { gte: new Date(now.getTime() - RANGE_SPANS[filters.range]) };
  }
  return where;
}

/** Matches the entries the Logs page's level, source and range pick that were written up to a moment.
 *
 * @param filters The page's filters. One that is off matches every entry.
 * @param readAt The moment to stop at, which an entry written at it is within,
 *   and which a range reaches back from; or undefined to match an entry
 *   whenever it was written, with a range reaching back from now.
 * @returns A filter for those entries.
 */
function writtenUpTo(filters: LogNarrowing, readAt: Date | undefined): LogWhereInput {
  const where = filtersWhere(filters, readAt ?? new Date());
  return readAt ? { AND: [where, { createdAt: { lte: readAt } }] } : where;
}

/** Reads every entry a filter matches that holds the text searched for, newest first.
 *
 * Every entry the filter matches is read, since the text is matched in code
 * rather than by the database; see `entryMatches`.
 *
 * @param where The level, source and range to read.
 * @param needle The search, already normalised by `normaliseQuery`.
 * @returns The entries that hold it.
 */
async function searchLogs(where: LogWhereInput, needle: string): Promise<LogEntryDTO[]> {
  const rows = await prisma.log.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toLogEntryDTO).filter((entry) => entryMatches(entry, needle));
}

/** Reads one page of the entries a filter matches, newest first.
 *
 * @param where The entries to read.
 * @param skip How many to pass over before the page starts.
 * @returns Up to `LOG_PAGE_SIZE` entries.
 */
async function readPage(where: LogWhereInput, skip: number): Promise<LogEntryDTO[]> {
  const rows = await prisma.log.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: LOG_PAGE_SIZE,
  });
  return rows.map(toLogEntryDTO);
}

/** Lists one page of the entries the Logs page's filters match, newest first.
 *
 * The counts come first, so a page past the last can show the last instead of
 * nothing. Entries written in the same millisecond are ordered by id, so a
 * page holds the same entries every time it is read.
 *
 * With no search, the database counts the matches and reads only the page.
 * With one, every entry the other filters match is read and searched, and the
 * page is cut from what holds the text.
 *
 * @param filters The page's filters and the page asked for.
 * @returns The page's entries, with the counts the page shows around them.
 */
export async function listLogPage(filters: LogFilters): Promise<LogPage> {
  const readAt = new Date();
  const where = filtersWhere(filters, readAt);
  const needle = normaliseQuery(filters.q);
  const [found, total, oldest, levels, auth, tasks, categories] = await Promise.all([
    needle === "" ? prisma.log.count({ where }) : searchLogs(where, needle),
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

  const matching = typeof found === "number" ? found : found.length;
  const pageCount = Math.max(1, Math.ceil(matching / LOG_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const skip = (page - 1) * LOG_PAGE_SIZE;
  const entries =
    typeof found === "number"
      ? await readPage(where, skip)
      : found.slice(skip, skip + LOG_PAGE_SIZE);

  // Every level starts at zero, so one with no entries still has a count to show.
  const levelCounts = Object.fromEntries(LOG_LEVELS.map((level) => [level, 0])) as Record<
    LogLevel,
    number
  >;
  for (const group of levels) levelCounts[group.level as LogLevel] = group._count._all;

  return {
    entries,
    page,
    pageCount,
    matching,
    total,
    oldest: oldest ? oldest.createdAt.toISOString() : null,
    levelCounts,
    sourceCounts: { auth, tasks, categories, system: total - auth - tasks - categories },
    readAt: readAt.toISOString(),
  };
}

/** The two fields that place an entry in a newest-first listing. */
interface ListPlace {
  /** When the entry was written. */
  createdAt: Date;
  /** Its id, which orders entries written in the same millisecond. */
  id: string;
}

/** Matches the entries that come after one in a newest-first listing.
 *
 * Those are the older entries, and the ones written in the same millisecond
 * with a lower id, matching the listing's order.
 *
 * @param entry The last entry already read.
 * @returns A filter for the entries that follow it.
 */
function listedAfter(entry: ListPlace): LogWhereInput {
  return {
    OR: [
      { createdAt: { lt: entry.createdAt } },
      { createdAt: entry.createdAt, id: { lt: entry.id } },
    ],
  };
}

/** Reads every entry the Logs page's filters match, newest first, a batch at a time.
 *
 * Each batch starts after the last entry of the one before rather than at an
 * offset. An entry written while the reading goes on would otherwise push
 * one already read into the next batch, and it would be read twice. An entry
 * written after the first batch is newer than everything in it, so it is left
 * out.
 *
 * A search is matched against each batch once it is read, so a batch can hold
 * fewer entries than were read for it.
 *
 * @param filters The page's filters, and the moment its counts were read, if
 *   the reading should stop there. Its page, if it has one, is ignored: every
 *   matching entry is read.
 * @param batchSize How many entries to read at a time.
 * @yields Each batch of matching entries, never an empty one.
 */
export async function* readLogBatches(
  filters: LogNarrowing & { readAt?: Date },
  batchSize = LOG_BATCH_SIZE
): AsyncGenerator<LogEntryDTO[]> {
  const where = writtenUpTo(filters, filters.readAt);
  const needle = normaliseQuery(filters.q);
  let last: ListPlace | undefined;
  while (true) {
    const rows = await prisma.log.findMany({
      where: last ? { AND: [where, listedAfter(last)] } : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: batchSize,
    });
    const entries = rows.map(toLogEntryDTO).filter((entry) => entryMatches(entry, needle));
    if (entries.length > 0) yield entries;
    if (rows.length < batchSize) return;
    last = rows[rows.length - 1];
  }
}

/** Deletes every entry written before a moment.
 *
 * One delete on a range of `createdAt`, which the table's index serves.
 * Running it again deletes nothing more, so two servers sharing the database
 * can both run it.
 *
 * @param cutoff The moment to delete before. An entry written at it is kept.
 * @returns How many entries were deleted.
 */
export async function deleteLogsBefore(cutoff: Date): Promise<number> {
  const { count } = await prisma.log.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

/** Deletes the entries the Logs page's filters match, written up to a moment.
 *
 * An entry written after the moment is kept, whatever it matches. With no
 * search it is one delete, which the `createdAt` index serves. With one, the
 * entries holding the text are found as an export finds them, then deleted by
 * id, `LOG_BATCH_SIZE` to a delete, all in one transaction, so a purge that
 * fails partway deletes nothing.
 *
 * @param filters The filters to match. One that is off matches every entry.
 * @param readAt The moment the entries were counted. An entry written at it is deleted.
 * @returns How many entries were deleted.
 */
export async function deleteLogs(filters: LogNarrowing, readAt: Date): Promise<number> {
  if (normaliseQuery(filters.q) === "") {
    const { count } = await prisma.log.deleteMany({ where: writtenUpTo(filters, readAt) });
    return count;
  }

  const ids: string[] = [];
  for await (const batch of readLogBatches({ ...filters, readAt })) {
    ids.push(...batch.map((entry) => entry.id));
  }
  const deletes = Array.from({ length: Math.ceil(ids.length / LOG_BATCH_SIZE) }, (_, index) =>
    prisma.log.deleteMany({
      where: { id: { in: ids.slice(index * LOG_BATCH_SIZE, (index + 1) * LOG_BATCH_SIZE) } },
    })
  );
  const results = await prisma.$transaction(deletes);
  return results.reduce((sum, { count }) => sum + count, 0);
}

/** Counts the entries written before a moment, which `deleteLogsBefore` would delete.
 *
 * @param cutoff The moment to count before. An entry written at it is not counted.
 * @returns How many entries there are.
 */
export function countLogsBefore(cutoff: Date): Promise<number> {
  return prisma.log.count({ where: { createdAt: { lt: cutoff } } });
}
