import { z } from "zod";

/** A six-digit hex colour. Shortened three-character codes are rejected. */
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex colour, e.g. #3b9eff");

/** Validates a category as submitted for creation. */
export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim() // strip whitespace BEFORE length checks
    .min(1, "Name is required") // "" and "   " both fail after trim
    .max(60),
  // Optional on input: when omitted, the schema's @default fills it in. The
  // value lives in prisma/schema.prisma alone — repeating it here would give
  // it a second home to drift from.
  color: hexColor.optional(),
});

/** Validates a category update: the same shape, every field optional. */
export const categoryUpdateSchema = categoryCreateSchema.partial();

/** A validated category ready to be created. */
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
/** A validated set of changes to an existing category. */
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
