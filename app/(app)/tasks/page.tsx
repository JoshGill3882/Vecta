import { requireSession } from "@/src/lib/session";
import { getTasks } from "@/src/server/services/tasks";
import { getCategories } from "@/src/server/services/categories";

import { TasksView } from "./tasks-view";

export default async function TasksPage() {
  await requireSession();

  const [tasks, categories] = await Promise.all([getTasks(), getCategories()]);

  return <TasksView tasks={tasks} categories={categories} />;
}
