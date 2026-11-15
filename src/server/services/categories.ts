import { CategoryDTO, toCategoryDTO } from "@/src/shared/lib/dtos/categories";
import { categoryCreateSchema, categoryUpdateSchema } from "@/src/shared/lib/schemas/categories";
import { prisma } from "@/src/server/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { ConflictError, NotFoundError } from "@/src/server/errors";
import { logger } from "@/src/server/logger";
import { changedFields } from "@/src/server/changed-fields";

// Category service — the seam all category DB access flows through. Each change
// is recorded as an activity entry here, once it has succeeded, so every caller
// is covered without having to remember to log.

/** The fields needed to create a category. */
export interface CreateCategoryInput {
  /** Display name. Required, and unique across categories. */
  name: string;
  /** Hex colour for the dot and the chip. Omitted takes the schema default. */
  color?: string;
}

/** The fields that may be changed on an existing category.
 *
 * Every one is optional: an omitted field is left as it was.
 */
export interface UpdateCategoryInput {
  /** Display name. */
  name?: string;
  /** Hex colour for the dot and the chip. */
  color?: string;
}

/** Gets all Categories
 *
 * @returns All Categories as DTOs
 */
export async function getCategories(): Promise<CategoryDTO[]> {
  const categories = await prisma.category.findMany();
  return categories.map((c) => toCategoryDTO(c));
}

/** Get a specific Category, based given an ID
 *
 * @param id ID of the Category to get
 * @returns The found Category as a DTO
 * @throws NotFoundError if it isn't found
 */
export async function getCategoryById(id: string): Promise<CategoryDTO> {
  try {
    const category = await prisma.category.findUniqueOrThrow({
      where: { id: id },
    });
    return toCategoryDTO(category);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Category", id);
    }
    throw e;
  }
}

/** Create a new Category, given input parameters
 *
 * @param input Input Parameters
 * @returns Category created as a DTO
 */
export async function createCategory(input: CreateCategoryInput): Promise<CategoryDTO> {
  const data = categoryCreateSchema.parse(input);
  try {
    const createdCategory = await prisma.category.create({ data });
    logger.activity.info("category.created", "Category created", {
      categoryId: createdCategory.id,
      name: createdCategory.name,
    });
    return toCategoryDTO(createdCategory);
  } catch (e) {
    // P2002 = unique constraint: a Category already owns this name.
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ConflictError(`A category named "${data.name}" already exists`);
    }
    throw e;
  }
}

/** Update a Category, given an ID and parameters
 *
 * @param id ID of the Category being updated
 * @param input New Category parameters
 * @returns Category as a DTO
 * @throws NotFoundError if the Category can't be found
 */
export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
  const data = categoryUpdateSchema.parse(input);
  try {
    // The read and the write run back to back in one transaction, so the fields
    // recorded as changed are compared against the row as it stood just before
    // this update. A missing category fails the read with the same P2025 the
    // update would have thrown.
    const [before, category] = await prisma.$transaction([
      prisma.category.findUniqueOrThrow({ where: { id: id } }),
      prisma.category.update({ where: { id: id }, data }),
    ]);
    logger.activity.info("category.updated", "Category updated", {
      categoryId: category.id,
      name: category.name,
      changed: changedFields(before, data),
    });
    return toCategoryDTO(category);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError) {
      // P2025 = no such category; P2002 = the new name collides with another.
      if (e.code === "P2025") throw new NotFoundError("Category", id);
      if (e.code === "P2002")
        throw new ConflictError(`A category named "${data.name}" already exists`);
    }
    throw e;
  }
}

/** Delete a Category, given an ID
 *
 * @param id ID of the Category to Delete
 */
export async function deleteCategory(id: string): Promise<void> {
  try {
    // Deleting a category uncategorises its tasks (the relation's onDelete:
    // SetNull). Counting them in the same transaction, just before the delete,
    // records how many that was. The deleted row comes back, so the entry can
    // still name the category.
    const [uncategorisedTasks, deletedCategory] = await prisma.$transaction([
      prisma.task.count({ where: { categoryId: id } }),
      prisma.category.delete({ where: { id: id } }),
    ]);
    logger.activity.info("category.deleted", "Category deleted", {
      categoryId: deletedCategory.id,
      name: deletedCategory.name,
      uncategorisedTasks,
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Category", id);
    }
    throw e;
  }
}
