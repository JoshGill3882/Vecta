import { z } from "zod";

// Single source of truth for statuses — reuse in the enum AND anywhere
// the UI needs the list (dropdowns, etc.). `as const` makes it a readonly tuple.
export const TASK_STATUSES = ["open", "in_progress", "closed"] as const;

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

// update = "same shape, everything optional"
export const taskUpdateSchema = taskCreateSchema.partial();

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
