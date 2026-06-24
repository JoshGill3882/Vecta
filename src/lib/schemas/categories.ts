import { z } from "zod";

// Hex colour: # followed by exactly 6 hex digits. Rejects shortened 3-character-codes
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex colour, e.g. #6366f1");

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim() // strip whitespace BEFORE length checks
    .min(1, "Name is required") // "" and "   " both fail after trim
    .max(60),
  // Optional on input: when omitted, Prisma's @default("#6366f1") fills it in.
  color: hexColor.optional(),
});

// update = "same shape, everything optional". Don't retype it — derive it.
export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
