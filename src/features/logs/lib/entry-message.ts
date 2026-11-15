import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";

/** What a refused sign-in says, by the reason recorded with it.
 *
 * A Map rather than an object, so a recorded reason can never match something
 * an object inherits, such as `constructor`.
 */
const SIGN_IN_FAILURES = new Map([
  ["wrong_password", "Sign-in failed: wrong password"],
  ["rate_limited", "Sign-in refused: too many attempts"],
]);

/** Reads one text field from an entry's detail.
 *
 * @param detail The entry's detail, or null when it has none.
 * @param key The field to read.
 * @returns The field's text, or null when it is missing, empty or not text.
 */
function textField(detail: LogEntryDTO["detail"], key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/** Puts what happened in front of the quoted name of what it happened to.
 *
 * @param action What happened, such as `Deleted category`.
 * @param subject The title or name it happened to, or null when none was recorded.
 * @returns The message, such as `Deleted category “Work”`, or null without a subject.
 */
function named(action: string, subject: string | null): string | null {
  return subject === null ? null : `${action} “${subject}”`;
}

/** Whether an update's detail lists a field among those it changed.
 *
 * @param detail The entry's detail, or null when it has none.
 * @param field The field to look for, such as `name`.
 * @returns True when `changed` is a list that includes it.
 */
function changed(detail: LogEntryDTO["detail"], field: string): boolean {
  const fields = detail?.changed;
  return Array.isArray(fields) && fields.includes(field);
}

/** Words an event that has wording of its own.
 *
 * @param event The entry's event name.
 * @param detail The entry's detail, or null when it has none.
 * @returns The message, or null when the event has no wording or its detail lacks what the wording needs.
 */
function worded(event: string, detail: LogEntryDTO["detail"]): string | null {
  switch (event) {
    case "task.created":
      return named("Created", textField(detail, "title"));
    case "task.updated":
      return named("Updated", textField(detail, "title"));
    case "task.deleted":
      return named("Deleted", textField(detail, "title"));
    case "category.created":
      return named("Created category", textField(detail, "name"));
    case "category.updated":
      return named(
        changed(detail, "name") ? "Renamed category to" : "Updated category",
        textField(detail, "name")
      );
    case "category.deleted":
      return named("Deleted category", textField(detail, "name"));
    case "auth.sign_in_failed":
      return SIGN_IN_FAILURES.get(textField(detail, "reason") ?? "") ?? null;
    default:
      return null;
  }
}

/** Writes the one-line message a Logs page row shows for an entry.
 *
 * A task or category entry names what it was about, from the title or name
 * recorded with it, since the stored message only says what kind of change it
 * was. Any other event, or one whose detail lacks what its wording needs, shows
 * its stored message, so a new event still reads sensibly.
 *
 * @param entry The entry to describe.
 * @returns The message for its row.
 */
export function entryMessage(entry: Pick<LogEntryDTO, "event" | "message" | "detail">): string {
  return worded(entry.event, entry.detail) ?? entry.message;
}
