import { updateTag } from "next/cache";

/** Cache tag names, in one place so a write and a read cannot spell one differently. */
const tags = {
  tasks: "tasks",
  task: (id: string) => `task-${id}`,
  categories: "categories",
  category: (id: string) => `category-${id}`,
};

/** Invalidates the cached task data after a write.
 *
 * @param id Invalidates that task's own tag as well as the collection, when given.
 */
export function revalidateTasks(id?: string) {
  updateTag(tags.tasks);
  if (id) updateTag(tags.task(id));
}

/** Invalidates the cached category data after a write.
 *
 * The task tag goes too: a card shows its category's name and colour, so a
 * renamed or recoloured category leaves every task rendering the old one.
 *
 * @param id Invalidates that category's own tag as well as the collection, when given.
 */
export function revalidateCategories(id?: string) {
  updateTag(tags.categories);
  if (id) updateTag(tags.category(id));
  updateTag(tags.tasks);
}
