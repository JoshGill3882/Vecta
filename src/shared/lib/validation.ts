import { z } from "zod";

/** The app-wide structured-errors contract.
 *
 * A discriminated union so callers narrow on `success` and are handed either
 * `data` or the error buckets, never both. `fieldErrors` is keyed by field
 * name; `formErrors` holds cross-field issues, which come from a `.refine()`
 * on the object rather than on any one field.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string[]>; formErrors: string[] };

/** Validates input against a Zod schema, flattening any failure.
 *
 * Defined once and reused by every Server Action and route handler, so the
 * error shape a caller has to handle is the same everywhere.
 *
 * @param schema The schema to validate against.
 * @param input Untrusted input, of unknown shape until this has vouched for it.
 * @returns The parsed data, or the failures keyed by field.
 */
export function validate<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  // z.flattenError is the Zod 4 replacement for the deprecated error.flatten().
  const flat = z.flattenError(result.error);
  return {
    success: false,
    // flattenError types field values as `string[] | undefined` (a key only
    // appears when it has issues). Drop the undefineds so callers get a clean
    // Record<string, string[]>.
    fieldErrors: Object.fromEntries(
      Object.entries(flat.fieldErrors).filter(
        (entry): entry is [string, string[]] => entry[1] !== undefined
      )
    ),
    formErrors: flat.formErrors,
  };
}
