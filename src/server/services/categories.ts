import { CategoryDTO, toCategoryDTO } from "@/src/lib/dtos/categories";
import { prisma } from "@/src/server/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { NotFoundError } from "@/src/server/errors";

// Category service — the seam all category DB access flows through.

export interface CreateCategoryInput {
  name: string;
  // Hex colour for the category dot / badge. Defaults to the schema default.
  color?: string;
}

export interface UpdateCategoryInput {
  name?: string;
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
  const createdCategory = await prisma.category.create({ data: input });
  return toCategoryDTO(createdCategory);
}

/** Update a Category, given an ID and parameters
 *
 * @param id ID of the Category being updated
 * @param input New Category parameters
 * @returns Category as a DTO
 * @throws NotFoundError if the Category can't be found
 */
export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
  try {
    const category = await prisma.category.update({
      where: { id: id },
      data: input,
    });
    return toCategoryDTO(category);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Category", id);
    }
    throw e;
  }
}

/** Delete a Category, given an ID
 *
 * @param id ID of the Category to Delete
 */
export async function deleteCategory(id: string): Promise<void> {
  await prisma.category.delete({ where: { id: id } });
}
