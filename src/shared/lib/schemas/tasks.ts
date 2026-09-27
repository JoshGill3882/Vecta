import { z } from "zod";

/** The three task statuses, in display order.
 *
 * Single source of truth: the Zod enum below and anywhere the UI needs the
 * list both read from here. `as const` makes it a readonly tuple, so the enum
 * takes its literal members rather than `string`.
 */
export const TASK_STATUSES = ["open", "in_progress", "closed"] as const;

/** A due date's shape: `YYYY-MM-DD`, optionally followed by `THH:MM`.
 *
 * The hour and minute ranges are checked here; whether the day exists is not,
 * because no pattern can know that February has no 30th.
 */
const DUE_AT_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/;

/** Whether a year, month and day name a day that exists.
 *
 * `Data.UTC` rolls an impossible day forward (30 February becomes 2 March) so a
 * real day is one that comes back unchanged. UTC because this is a calendar
 * question, not a moment in time: it must not depend on the server's timezone.
 *
 * @param year Four-digit year.
 * @param month Month, 1-12.
 * @param day Day of the month.
 * @returns True when the day exists.
 */
function isRealDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Validates a due date: local wall-clock text, with an optional time of day. */
export const dueAtSchema = z
  .string()
  .regex(DUE_AT_PATTERN, "Use YYYY-MM-DD, optionally followed by THH:MM")
  .refine((value) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return isRealDay(year, month, day);
  }, "That date does not exist");

/** Validates a task as submitted for creation. */
export const taskCreateSchema = z.object({
  title: z
    .string()
    .trim() // strip whitespace BEFORE length checks
    .min(1, "Title is required") // "" and "   " both fail after trim
    .max(120, "Title must be 120 characters or fewer"),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(TASK_STATUSES), // value must be one of the three
  // string = assign to a category, null = explicitly unassign, omitted = leave as-is.
  // null/optional mirror the Prisma `categoryId String?` column so the service-layer
  // .parse() accepts every shape the model supports.
  categoryId: z.cuid().nullable().optional(), // matches Prisma @default(cuid()) ids
  // string = set a due date, null = clear it, omitted = leave as-is - the same
  // three shapes as categoryId, mirroring the `dueAt String?` column.
  dueAt: dueAtSchema.nullable().optional(),
});

/** Validates a task update: the same shape, every field optional. */
export const taskUpdateSchema = taskCreateSchema.partial();

/** A validated task ready to be created. */
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
/** A validated set of changes to an existing task. */
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
