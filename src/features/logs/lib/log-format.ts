import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { LOG_PAGE_SIZE } from "@/src/shared/lib/schemas/logs";

/** The locale the Logs page writes numbers and dates in, the same one the task
 * list uses, so both pages read alike. */
const LOCALE = "en-GB";

/** Writes a count with its thousands grouped, such as `1,204`.
 *
 * @param count Any whole number.
 * @returns The number as text.
 */
export function formatCount(count: number): string {
  return count.toLocaleString(LOCALE);
}

/** Writes how many entries there are, such as `1 entry` or `1,204 entries`.
 *
 * @param count How many entries.
 * @returns The count with its noun.
 */
export function entryCount(count: number): string {
  return `${formatCount(count)} ${count === 1 ? "entry" : "entries"}`;
}

/** Writes which of the matching entries a page shows, such as `51-100 of 1,204`.
 *
 * @param page Which page, from 1. It must hold at least one entry.
 * @param matching How many entries the filters match.
 * @returns The first and last entry on the page, and how many match.
 */
export function pageRange(page: number, matching: number): string {
  const first = (page - 1) * LOG_PAGE_SIZE + 1;
  const last = Math.min(page * LOG_PAGE_SIZE, matching);
  return `${formatCount(first)}-${formatCount(last)} of ${formatCount(matching)}`;
}

/** Writes the day an entry was written, such as `14 Nov 2026`.
 *
 * @param iso The entry's ISO 8601 timestamp.
 * @returns The date, in the time zone of whatever renders it.
 */
export function logDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Writes the time an entry was written, such as `09:30:05`.
 *
 * @param iso The entry's ISO 8601 timestamp.
 * @returns The time on a 24-hour clock, in the time zone of whatever renders it.
 */
export function logTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** One day's entries, under the heading the Logs page gives it. */
export interface LogDay {
  /** The day as `YYYY-MM-DD` in local time, unique on a page, so it can key the group. */
  key: string;
  /** The day's heading, such as `Today`, `Sat 14 Nov` or `Fri, 14 Nov 2025`. */
  label: string;
  /** The day's entries, in the order they were given. */
  entries: LogEntryDTO[];
}

/** Names a day by its local date.
 *
 * @param date Any moment in the day.
 * @returns The day as `YYYY-MM-DD`.
 */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Writes the heading for a day of entries.
 *
 * Yesterday is found by stepping back one day of the calendar, not 24 hours,
 * so on the day the clocks change it is still the day before.
 *
 * @param date Any moment in the day.
 * @param now The moment "today" is taken from.
 * @returns `Today`, `Yesterday`, or the date, with the year only when it is not this one.
 */
function dayLabel(date: Date, now: Date): string {
  const key = dayKey(date);
  if (key === dayKey(now)) return "Today";

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === dayKey(yesterday)) return "Yesterday";

  return date.toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Writes when something ran, such as `03:00 today`, `03:00 yesterday` or `03:00 on 14 Nov 2026`.
 *
 * @param iso When it ran, as an ISO 8601 timestamp.
 * @param now The moment "today" is taken from.
 * @returns The time on a 24-hour clock and the day, in the time zone of whatever renders it.
 */
export function runTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  const day = dayLabel(at, now);
  if (day === "Today" || day === "Yesterday") return `${time} ${day.toLowerCase()}`;
  return `${time} on ${logDate(iso)}`;
}

/** Groups a page of entries under a heading per day.
 *
 * Only neighbouring entries share a group, so the entries must arrive in time
 * order, as a page of the log does.
 *
 * @param entries The entries, newest first.
 * @param now The moment "today" is taken from, taken once by the caller.
 * @returns The days, in the order their entries came.
 */
export function groupByDay(entries: LogEntryDTO[], now: Date): LogDay[] {
  const days: LogDay[] = [];
  for (const entry of entries) {
    const at = new Date(entry.createdAt);
    const key = dayKey(at);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, label: dayLabel(at, now), entries: [entry] });
  }
  return days;
}
