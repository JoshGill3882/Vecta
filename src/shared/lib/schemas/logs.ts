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

/** How many entries one page of the Logs page shows. */
export const LOG_PAGE_SIZE = 50;

/** Reads the Logs page's filters from its query string.
 *
 * Nothing here refuses a request. An unknown level or source clears that
 * filter, and a page that is not a whole number from 1 opens the first, so a
 * stale or hand-edited link still shows the log rather than an error.
 */
export const logFiltersSchema = z.object({
  level: z.preprocess(asList, z.array(z.enum(LOG_LEVELS))).catch([]),
  source: z.preprocess(asList, z.array(z.enum(LOG_SOURCES))).catch([]),
  page: z.coerce.number().int().min(1).catch(1),
});

/** The Logs page's filters, once read from the query string. */
export type LogFilters = z.output<typeof logFiltersSchema>;
