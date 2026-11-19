import { z } from "zod";

/** The two kinds of entry the log holds.
 *
 * `operational` is what happened on the server, such as an unexpected error or
 * start-up. `activity` is a change the user made to their data.
 */
export const LOG_KINDS = ["operational", "activity"] as const;

/** Severity levels, from least to most severe.
 *
 * The order is meaningful: a minimum level keeps every level at or after its
 * position in this list.
 */
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

/** Where an entry came from, as the Logs page groups them.
 *
 * Not stored: an entry's source is read from its event name, so every entry
 * has one, however old it is.
 */
export const LOG_SOURCES = ["auth", "tasks", "categories", "system"] as const;

/** An event name's shape: lowercase words joined by dots, such as `task.deleted`.
 *
 * At least two words, so every name says what it is about as well as what
 * happened. Underscores join the words within one part (`action.unexpected_error`).
 */
const EVENT_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

/** Validates a log entry before it is written.
 *
 * `detail` must be an object, never a bare value, so every entry's context is
 * keyed and can be read back by name.
 */
export const logWriteSchema = z.object({
  kind: z.enum(LOG_KINDS),
  level: z.enum(LOG_LEVELS),
  event: z
    .string()
    .regex(EVENT_PATTERN, "Use lowercase words joined by dots, such as task.deleted"),
  message: z.string().min(1, "A log entry needs a message"),
  detail: z.record(z.string(), z.unknown()).optional(),
});

/** The fields a caller supplies to write a log entry. */
export type LogWriteInput = z.input<typeof logWriteSchema>;

/** Turns a query-string parameter into a list, whether it was left out, given once or repeated.
 *
 * @param value The parameter as Next passes it: undefined, a string, or an array of strings.
 * @returns The values it holds, as an array.
 */
function asList(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Turns a query-string parameter given once into its value.
 *
 * A parameter given once is passed on as a list of one by some readers, such
 * as `getAll`, and as a string by others, such as Next's `searchParams`, so
 * both are read the same. A repeated one is left as a list, which a field
 * holding one value refuses.
 *
 * @param value The parameter: undefined, a string, or an array of strings.
 * @returns The value given once, or the parameter unchanged.
 */
function asOne(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

/** How many entries one page of the Logs page shows. */
export const LOG_PAGE_SIZE = 50;

/** The longest search the Logs page accepts, in characters. */
export const LOG_SEARCH_MAX = 200;

/** The recent periods the Logs page can narrow to. Any time is no range at all. */
export const LOG_RANGES = ["24h", "7d", "30d"] as const;

/** A recent period the Logs page can narrow to. */
export type LogRange = (typeof LOG_RANGES)[number];

/** One hour, in milliseconds. */
const HOUR = 60 * 60 * 1000;

/** How far back each range reaches, in milliseconds.
 *
 * Spans of 24 hours rather than calendar days, so "Last 24 hours" means what
 * it says whatever the time of day, and a change of the clocks moves nothing.
 */
export const RANGE_SPANS: Record<LogRange, number> = {
  "24h": 24 * HOUR,
  "7d": 7 * 24 * HOUR,
  "30d": 30 * 24 * HOUR,
};

/** Reads the Logs page's filters from its query string.
 *
 * Nothing here refuses a request. An unknown level, source or range clears
 * that filter, as does a search that is repeated or too long, and a page that
 * is not a whole number from 1 opens the first, so a stale or hand-edited link
 * still shows the log rather than an error.
 */
export const logFiltersSchema = z.object({
  q: z.preprocess(asOne, z.string().trim().max(LOG_SEARCH_MAX)).catch(""),
  level: z.preprocess(asList, z.array(z.enum(LOG_LEVELS))).catch([]),
  source: z.preprocess(asList, z.array(z.enum(LOG_SOURCES))).catch([]),
  range: z.preprocess(asOne, z.enum(LOG_RANGES).nullable()).catch(null),
  page: z.coerce.number().int().min(1).catch(1),
});

/** The Logs page's filters, once read from the query string. */
export type LogFilters = z.output<typeof logFiltersSchema>;

/** What the Logs page's filters narrow the log to, without the page being shown. */
export type LogNarrowing = Omit<LogFilters, "page">;

/** No filters at all, which match every entry. */
export const NO_FILTERS: LogNarrowing = { q: "", level: [], source: [], range: null };

/** Whether any filter is on, so the log is narrowed.
 *
 * The one test of it, so the count, Clear filters, Export and Purge all agree
 * on whether a filter is on, and a new filter only has to be added here.
 *
 * @param filters The filters to look at.
 * @returns True when there is a search, a level, a source or a range.
 */
export function isFiltered(filters: LogNarrowing): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.level.length > 0 ||
    filters.source.length > 0 ||
    filters.range !== null
  );
}

/** What a purge deletes: the entries the filters match, or every entry. */
export const PURGE_SCOPES = ["filtered", "all"] as const;

/** When the Logs page's counts were read, which bounds a purge and its export. */
export const logReadAtSchema = z.iso.datetime().transform((value) => new Date(value));

/** Validates a purge before it runs.
 *
 * Stricter than the page's filters: an unknown level, source or range, or a
 * search that is too long, is refused rather than cleared, because clearing it
 * would widen the purge to entries the confirmation never counted. A filtered
 * purge needs a filter on, so one recorded as filtered always was.
 */
export const logPurgeSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all"), readAt: logReadAtSchema }),
  z
    .object({
      scope: z.literal("filtered"),
      q: z.string().trim().max(LOG_SEARCH_MAX),
      level: z.array(z.enum(LOG_LEVELS)),
      source: z.array(z.enum(LOG_SOURCES)),
      range: z.enum(LOG_RANGES).nullable(),
      readAt: logReadAtSchema,
    })
    .refine(isFiltered, { message: "Turn a filter on to purge what it matches" }),
]);

/** A purge, once validated. */
export type LogPurge = z.output<typeof logPurgeSchema>;
