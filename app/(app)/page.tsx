import { TasksView } from "@/src/components/tasks/tasks-view";
import { requireSession } from "@/src/lib/session";

export default async function TasksPage() {
  await requireSession();

  return <TasksView />;
}
