import { requireSession } from "@/src/lib/session";
import { getCategories } from "@/src/server/services/categories";
import { getTasks } from "@/src/server/services/tasks";

import { CategoriesView } from "./categories-view";

export default async function CategoriesPage() {
  await requireSession();

  const [categories, tasks] = await Promise.all([getCategories(), getTasks()]);

  // Per-category task counts. Derived here rather than in the category service
  // because the count is a property of *this view*, not of a Category — the
  // service's job is to return CategoryDTOs, not to know what a page displays.
  const taskCounts: Record<string, number> = {};
  for (const task of tasks) {
    if (task.categoryId) taskCounts[task.categoryId] = (taskCounts[task.categoryId] ?? 0) + 1;
  }

  return <CategoriesView categories={categories} taskCounts={taskCounts} />;
}
