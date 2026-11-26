import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";

/** The categories whose name holds the search, keeping one whatever its name.
 *
 * @param categories The full list, in the order it is shown.
 * @param needle The search, already normalised by `normaliseQuery`. Empty
 *   means "no search" and matches every category.
 * @param keepId A category to keep in the list even when its name does not
 *   match, such as the one open in an editor: renaming it away from the search
 *   must not pull the form out from under the reader. Null keeps none.
 * @returns The categories that match, in their order, or the input itself when
 *   there is no search, so the common case costs no copy.
 */
export function narrowCategories(
  categories: CategoryDTO[],
  needle: string,
  keepId: string | null
): CategoryDTO[] {
  if (needle === "") return categories;
  return categories.filter(
    (category) => category.id === keepId || category.name.toLowerCase().includes(needle)
  );
}
