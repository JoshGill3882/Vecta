import type { ActionFailure } from "@/src/shared/lib/result";

/** A failed action's errors, split by whether a form has somewhere to show them. */
export interface SplitFieldErrors<F extends string> {
  /** The first message for each of the form's own fields, ready for `setError`. */
  placed: Array<[field: F, message: string]>;
  /** What the caller still has to report some other way, or null when nothing is left. */
  remainder: string | null;
}

/** Whether an error's key names one of the form's fields.
 *
 * @param key The key the action reported the error under.
 * @param fields The form's fields.
 * @returns True when the form has the field, narrowing the key to it.
 */
function isFormField<F extends string>(key: string, fields: readonly F[]): key is F {
  return (fields as readonly string[]).includes(key);
}

/** Splits a failed action's field errors between a form's fields and everything else.
 *
 * Only a field the form has is placed. An error keyed to any other field joins
 * the remainder with its key attached, so a form that has fallen out of step
 * with the server still reports what the server said instead of dropping it.
 * A failure with nothing to place leaves its own message as the remainder,
 * since that is then the only thing saying what went wrong.
 *
 * @param failure The failed result.
 * @param fields The fields the form shows an error under.
 * @returns The errors to place, and the message left over.
 */
export function splitFieldErrors<F extends string>(
  failure: ActionFailure,
  fields: readonly F[]
): SplitFieldErrors<F> {
  const placed: Array<[F, string]> = [];
  const unplaced: string[] = [];

  for (const [key, messages] of Object.entries(failure.fieldErrors ?? {})) {
    // One message per field, because a field has one place to show it.
    const message = messages[0];
    if (message === undefined) continue;

    if (isFormField(key, fields)) placed.push([key, message]);
    else unplaced.push(`${key}: ${message}`);
  }

  if (unplaced.length > 0) return { placed, remainder: unplaced.join("; ") };
  return { placed, remainder: placed.length > 0 ? null : failure.error };
}
