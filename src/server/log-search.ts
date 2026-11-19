import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { entryMessage } from "@/src/shared/lib/entry-message";

// Log search - decides whether an entry holds the text the Logs page searches
// for. It is matched here, in code, rather than by the database: a database's
// substring match reads `%` and `_` in the text as wildcards, and ignores case
// for unaccented letters at most, while this matches the text exactly as typed
// and ignores case for every letter, whichever engine holds the log.

/** Collects every value in an entry's detail as text, however deeply it is nested.
 *
 * The keys are left out, since names such as `title` or `id` would match
 * nearly every entry. So are true, false and null, which read as words that
 * were never typed.
 *
 * @param value The detail, or a value inside it.
 * @param into The list to add to.
 * @returns The list, with every string and number found added.
 */
function detailValues(value: unknown, into: string[]): string[] {
  if (typeof value === "string") into.push(value);
  else if (typeof value === "number") into.push(String(value));
  else if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) detailValues(inner, into);
  }
  return into;
}

/** Whether an entry holds the text searched for, ignoring case.
 *
 * It is looked for in the message the entry's row shows, its stored message,
 * its event name and every value in its detail. The row's message comes
 * first, since it is what the reader sees: a task's row says `Deleted “Buy
 * milk”` where the stored message says only `Task deleted`.
 *
 * @param entry The entry to look in.
 * @param needle The search, already normalised by `normaliseQuery`. Empty
 *   matches every entry.
 * @returns True when any of those holds it.
 */
export function entryMatches(entry: LogEntryDTO, needle: string): boolean {
  if (needle === "") return true;
  const texts = [
    entryMessage(entry),
    entry.message,
    entry.event,
    ...detailValues(entry.detail, []),
  ];
  return texts.some((text) => text.toLowerCase().includes(needle));
}
