import { requireSession } from "@/src/shared/lib/session";
import { getTasks } from "@/src/server/services/tasks";
import { getCategories } from "@/src/server/services/categories";
import { readPreferenceCookie } from "@/src/shared/lib/read-preference-cookie";
import {
  parseCollapsed,
  SECTION_COLLAPSE_COOKIE,
  SECTION_COLLAPSE_DEFAULTS,
} from "@/src/features/tasks/lib/section-collapse";
import {
  DEFAULT_TASK_SORT,
  parseTaskSort,
  TASK_SORT_COOKIE,
} from "@/src/features/tasks/lib/task-sort";

import { TasksView } from "@/src/features/tasks/components/tasks-view";

/** The task list route: authenticates, fetches, and hands off to the view. */
export default async function TasksPage() {
  await requireSession();

  const [tasks, categories, sort, collapsed] = await Promise.all([
    getTasks(),
    getCategories(),
    readPreferenceCookie(TASK_SORT_COOKIE, parseTaskSort, DEFAULT_TASK_SORT),
    readPreferenceCookie(SECTION_COLLAPSE_COOKIE, parseCollapsed, SECTION_COLLAPSE_DEFAULTS),
  ]);

  return (
    <TasksView
      tasks={tasks}
      categories={categories}
      initialSort={sort}
      initialCollapsed={collapsed}
    />
  );
}
