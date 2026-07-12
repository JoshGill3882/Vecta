import { requireSession } from "@/src/lib/session";

import { TasksView } from "./tasks-view";

export default async function TasksPage() {
  await requireSession();

  return <TasksView />;
}
