import { z } from "zod";

// The app-wide "structured errors" contract: a discriminated union so
// callers narrow on `success` and TypeScript hands them either `data` or the
// error buckets — never both.
//
//   fieldErrors — keyed by field name, e.g. { title: ["Title is required"] }
//   formErrors  — cross-field / non-field issues (from .refine() on the object)
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string[]>; formErrors: string[] };

// Validate `input` against any Zod schema and flatten failures into the shape
// above. Define it once; every server action / route handler reuses it so the
// error shape stays uniform across the app.
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
