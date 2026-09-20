import { z } from "zod";

/** The three task statuses, in display order.
 *
 * Single source of truth: the Zod enum below and anywhere the UI needs the
 * list both read from here. `as const` makes it a readonly tuple, so the enum
 * takes its literal members rather than `string`.
 */
export const TASK_STATUSES = ["open", "in_progress", "closed"] as const;

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
});

/** Validates a task update: the same shape, every field optional. */
export const taskUpdateSchema = taskCreateSchema.partial();

/** A validated task ready to be created. */
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
/** A validated set of changes to an existing task. */
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
