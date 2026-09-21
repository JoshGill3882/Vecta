import { DomainError } from "@/src/server/errors";

/** What every Server Action resolves to: the data, or a reportable failure.
 *
 * A discriminated union so a caller narrows on `ok` and is handed one or the
 * other, never both and never a half-populated object.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/** Turns a thrown error into a failure a caller can report.
 *
 * @param e Whatever was thrown.
 * @returns A failed result: the error's own message when it is one we raise,
 *   a generic one otherwise, so an unexpected failure cannot leak its internals
 *   to the client.
 */
export function toActionError(e: unknown): ActionResult<never> {
  // Anticipated: safe to surface a friendly message + machine-readable code
  if (e instanceof DomainError) {
    return { ok: false, error: e.message, code: e.code };
  }
  // Unanticipated: record for observability, return a generic message
  console.error("[action] unexpected error", e); // or your logger
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** An action result as form state, where null is "nothing submitted yet". */
export type FormState<T> = ActionResult<T> | null;
