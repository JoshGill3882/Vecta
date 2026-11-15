/** The locale the Logs page writes numbers and dates in, the same one the task
 * list uses, so both pages read alike. */
const LOCALE = "en-GB";

/** Writes how many entries there are, such as `1 entry` or `1,204 entries`.
 *
 * @param count How many entries.
 * @returns The count with its noun.
 */
export function entryCount(count: number): string {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? "entry" : "entries"}`;
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
