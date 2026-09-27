import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

/** The locale every due is written in. Explicit rather than the runtime's
 * default, so the server's first render and the browser's use the same works -
 * the same reason `task-sort.ts` passes one to `localeCompare`. */
const LOCALE = "en-GB";

/** Milliseconds in a day, for whole-day arithmetic. */
const DAY_MS = 86_400_000;

/** A calendar day as a day count.
 *
 * Through `Date.UTC`, so a daylight-saving change between two dates cannot make
 * a 23 or 25 hours long and knock a difference off by one.
 *
 * @param year Four-digit year.
 * @param month Month, 1-12
 * @param day Day of the month.
 * @returns Days since the unix epoch.
 */
function dayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** How many calendar days a date is from today.
 *
 * @param dayKey The date as `YYYY-MM-DD`.
 * @param now The moment "today" is taken from, in local time.
 * @returns 0 for today, 1 for tomorrow, negative when the date has passed.
 */
function daysFromToday(dayKey: string, now: Date): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  return (
    dayNumber(year, month, day) - dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate())
  );
}

/** The moment a due date falls due, as text that sorts chronologically.
 *
 * A date-only due date is due at the end of its day, so it must sort after any
 * due time on the same day. `T23:59:59` is later than every `THH:MM` the column
 * can hold, so plain string order does that with no date parsing.
 *
 * @param dueAt The stored value.
 * @returns `YYYY-MM-DDTHH:MM`, or `YYYY-MM-DDT23:59:59` for a date-only value.
 */
export function dueMoment(dueAt: string): string {
  return dueAt.includes("T") ? dueAt : `${dueAt}T23:59:59`;
}

/** How a due date reads on screen. */
export interface DueMeta {
  /** Within the next seven days, further out, or already passed. */
  state: "soon" | "future" | "past";
  /** The pill's short text, such as "Due tomorrow · 17:30". */
  label: string;
  /** A clock when a time matters, a calendar otherwise. */
  icon: "clock" | "calendar";
  /** The whole date, such as "Friday 9 October 2026 at 17:30". */
  full: string;
}

/** Describes a task's due date for display.
 *
 * The one place the app decides what a due date means relative to today. The
 * card reads it; overdue marking and the due-date filter extend it rather than
 * working dates out for themselves, so none of them can disagree with the card.
 *
 * @param task The task; only its due date is read.
 * @param now The moment to measure against, taken once per render by the caller.
 * @returns The description, or null when the task has no due date.
 */
export function dueMeta(task: Pick<TaskDTO, "dueAt">, now: Date): DueMeta | null {
  if (!task.dueAt) return null;

  // No timezone suffix, so this is read as local time: the 15th stays the 15th.
  const at = new Date(dueMoment(task.dueAt));
  const days = daysFromToday(task.dueAt.slice(0, 10), now);

  const time = task.dueAt.includes("T")
    ? at.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })
    : null;
  const suffix = time ? ` · ${time}` : "";
  const icon = time ? "clock" : "calendar";
  const full =
    at.toLocaleDateString(LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) + (time ? ` at ${time}` : "");

  if (days === 0) return { state: "soon", label: `Due today${suffix}`, icon: "clock", full };
  if (days === 1) return { state: "soon", label: `Due tomorrow${suffix}`, icon: "clock", full };
  if (days > 1 && days < 7) {
    const weekday = at.toLocaleDateString(LOCALE, { weekday: "short" });
    return { state: "soon", label: `Due ${weekday}${suffix}`, icon, full };
  }

  const short = at.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  return { state: days < 0 ? "past" : "future", label: `Due ${short}${suffix}`, icon, full };
}
