/** What typed date text means. */
export type DateInputResult =
  | {
      /** Nothing was typed, which clears the due date rather than it being a mistake. */
      status: "empty";
    }
  | {
      /** The text names a real date. */
      status: "valid";
      /** The date as `YYYY-MM-DD`. */
      dayKey: string;
    }
  | {
      /** The text names no date, or one that does not exist, such as 31 February. */
      status: "invalid";
    };

/** The result for text that names no date. */
const INVALID: DateInputResult = { status: "invalid" };

/** Month names by the first three letters, January first. */
const MONTH_ABBR = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/** Words for a day near today, as days from it.
 *
 * A `Map` rather than an object literal: looking up typed text on a plain object
 * also finds what every object inherits, so `constructor` would read as a day.
 */
const RELATIVE_DAYS = new Map([
  ["today", 0],
  ["tod", 0],
  ["tomorrow", 1],
  ["tom", 1],
  ["tmr", 1],
  ["yesterday", -1],
]);

/** A year as typed: two digits or four, never three. */
const YEAR = String.raw`\d{2}(?:\d{2})?`;

/** `+3`, `-3`, `+3d`: days from today, up to three digits. */
const OFFSET = /^(?<sign>[+-])\s*(?<days>\d{1,3})\s*d?$/;

/** `2026-09-24`, with `-`, `/` or `.` between the parts. */
const ISO = /^(?<year>\d{4})[-/.](?<month>\d{1,2})[-/.](?<day>\d{1,2})$/;

/** `24/9/26` or `24/9`, read day first. */
const DAY_FIRST = new RegExp(
  String.raw`^(?<day>\d{1,2})[-/.](?<month>\d{1,2})(?:[-/.](?<year>${YEAR}))?$`
);

/** `24 sep`, `24 september 2026`. */
const DAY_MONTH_NAME = new RegExp(
  String.raw`^(?<day>\d{1,2})\s+(?<name>[a-z]{3,})\.?(?:\s+(?<year>${YEAR}))?$`
);

/** `sep 24`, `sep 24, 2026`. */
const MONTH_NAME_DAY = new RegExp(
  String.raw`^(?<name>[a-z]{3,})\.?\s+(?<day>\d{1,2})(?:,?\s+(?<year>${YEAR}))?$`
);

/** `24`: a day of the current month. */
const BARE_DAY = /^(?<day>\d{1,2})$/;

/** Formats a date as `YYYY-MM-DD` from its local fields.
 *
 * Never through `toISOString`, which converts to UTC first and so hands a reader
 * west of UTC the next day's date in the evening.
 *
 * @param date The date; its time of day is ignored.
 * @returns The date as `YYYY-MM-DD`
 */
function dayKeyOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Moves a date by whole calendar days.
 *
 * Through `setDate` rather than by adding milliseconds, so a daylight-saving
 * change cannot make a day 23 or 25 hours long and land on the wrong date.
 *
 * @param date The starting date; left unchanged.
 * @param days Days to move, negative for earlier.
 * @returns A new date.
 */
function addDays(date: Date, days: number): Date {
  const moved = new Date(date);
  moved.setDate(moved.getDate() + days);
  return moved;
}

/** Expands a typed year to four digits.
 *
 * @param typed The year as typed, two or four digits, or undefined when none was.
 * @param fallback The year to use when none was typed.
 * @returns The full year, with two digits read as this century.
 */
function fullYear(typed: string | undefined, fallback: number): number {
  if (!typed) return fallback;
  const year = Number(typed);
  return year < 100 ? 2000 + year : year;
}

/** The result of a date that exists.
 *
 * @param date The date; its time of day is ignored.
 * @returns The valid result carrying its `YYYY-MM-DD` key.
 */
function valid(date: Date): DateInputResult {
  return { status: "valid", dayKey: dayKeyOf(date) };
}

/** Checks that a day, month and year name a real date.
 *
 * `Date` silently rolls an impossible date forward - 31 February becomes
 * 3 March - so a date whose month or day comes back changed was never real.
 *
 * @param year Four-digit year.
 * @param month Month, 1-12; anything else is rejected.
 * @param day Day of the month; one the month does not have is rejected.
 * @returns The valid result, or invalid when the date does not exist.
 */
function dateResult(year: number, month: number, day: number): DateInputResult {
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return INVALID;
  return valid(date);
}

/** Reads a date typed into the due-date field.
 *
 * Accepts relative words (`today`, `tomorrow`), day offsets (`+3`), ISO dates,
 * day-first numeric dates (`24/9/26`) and month names in either order
 * (`24 sep`, `sep 24`). A date with no year takes today's.
 *
 * @param raw The text as typed; case and surrounding space are ignored.
 * @param today The day relative words and missing years are measured from.
 * @returns Empty for blank text, the date when it names a real one, otherwise invalid.
 */
export function parseDateInput(raw: string, today: Date): DateInputResult {
  const text = raw.trim().toLowerCase();
  if (!text) return { status: "empty" };

  const relative = RELATIVE_DAYS.get(text);
  if (relative !== undefined) return valid(addDays(today, relative));

  let groups = OFFSET.exec(text)?.groups;
  if (groups) {
    const days = Number(groups.days);
    return valid(addDays(today, groups.sign === "-" ? -days : days));
  }

  groups = ISO.exec(text)?.groups;
  if (groups) return dateResult(Number(groups.year), Number(groups.month), Number(groups.day));

  groups = DAY_FIRST.exec(text)?.groups;
  if (groups) {
    const year = fullYear(groups.year, today.getFullYear());
    return dateResult(year, Number(groups.month), Number(groups.day));
  }

  groups = (DAY_MONTH_NAME.exec(text) ?? MONTH_NAME_DAY.exec(text))?.groups;
  if (groups) {
    // Matched on the first three letters, so `sept` and `september` both work.
    const month = MONTH_ABBR.indexOf(groups.name.slice(0, 3)) + 1;
    if (month === 0) return INVALID;
    return dateResult(fullYear(groups.year, today.getFullYear()), month, Number(groups.day));
  }

  groups = BARE_DAY.exec(text)?.groups;
  if (groups) return dateResult(today.getFullYear(), today.getMonth() + 1, Number(groups.day));

  return INVALID;
}
