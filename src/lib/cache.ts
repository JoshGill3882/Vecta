import { updateTag } from "next/cache";

const tags = {
  tasks: "tasks",
  task: (id: string) => `task-${id}`,
  categories: "categories",
  category: (id: string) => `category-${id}`,
};

export function revalidateTasks(id?: string) {
  updateTag(tags.tasks);
  if (id) updateTag(tags.task(id));
}

export function revalidateCategories(id?: string) {
  updateTag(tags.categories);
  if (id) updateTag(tags.category(id));
  updateTag(tags.tasks);
}
