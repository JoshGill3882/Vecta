"use server";

import { ActionResult, toActionError } from "@/src/lib/result";
import { CategoryDTO } from "@/src/lib/dtos/categories";
import { createCategory, updateCategory, deleteCategory } from "@/src/server/services/categories";
import { revalidateCategories } from "@/src/lib/cache";
import { validate } from "@/src/lib/validation";
import { categoryCreateSchema, categoryUpdateSchema } from "@/src/lib/schemas/categories";
import { requireSession } from "@/src/lib/session";

/** Server Action for creating a Category
 *
 * @param formData Form data from the page
 * @returns ActionResult with new CategoryDTO or Error
 */
export async function createCategoryAction(formData: FormData): Promise<ActionResult<CategoryDTO>> {
  await requireSession();

  const result = validate(categoryCreateSchema, Object.fromEntries(formData));
  if (!result.success)
    return { ok: false, error: "Invalid input", fieldErrors: result.fieldErrors };

  try {
    const data = await createCategory(result.data);
    revalidateCategories();
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

/** Server Action for updating a Category
 *
 * @param id ID of the Category being deleted
 * @param formData Form Data from the Page
 * @returns ActionResult with new CategoryDTO or Error
 */
export async function updateCategoryAction(
  id: string,
  formData: FormData
): Promise<ActionResult<CategoryDTO>> {
  await requireSession();

  if (!id) return { ok: false, error: "Missing Category ID" };
  const result = validate(categoryUpdateSchema, Object.fromEntries(formData));
  if (!result.success)
    return { ok: false, error: "Invalid input", fieldErrors: result.fieldErrors };

  try {
    const data = await updateCategory(id, result.data);
    revalidateCategories(id);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

/** Server Action for deleting a Category
 *
 * @param id The ID of the Category being deleted
 * @returns ActionResult with empty content or Error
 */
export async function deleteCategoryAction(id: string): Promise<ActionResult<void>> {
  await requireSession();

  if (!id) return { ok: false, error: "Missing Category ID" };

  try {
    await deleteCategory(id);
    revalidateCategories(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
