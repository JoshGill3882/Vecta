import type { CategoryModel } from "@/generated/prisma/models";

/**
 * Category service — the seam all category DB access flows through.
 *
 * Bodies are stubbed until Phase 3 (Backend); see docs/PLAN.md §6. Signatures are
 * the contract callers (Server Actions / route handlers) build against now, and
 * are where service-action-boundary logging lands in Phase 3.
 */

export interface CreateCategoryInput {
  name: string;
  /** Hex colour for the category dot / badge. Defaults to the schema default. */
  color?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
}

export async function getCategories(): Promise<CategoryModel[]> {
  throw new Error("not implemented");
}

export async function getCategoryById(id: string): Promise<CategoryModel | null> {
  void id;
  throw new Error("not implemented");
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryModel> {
  void input;
  throw new Error("not implemented");
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<CategoryModel> {
  void id;
  void input;
  throw new Error("not implemented");
}

export async function deleteCategory(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
