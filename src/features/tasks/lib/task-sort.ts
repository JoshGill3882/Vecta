import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

/** One of the orders the list can be shown in. */
export type TaskSort = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

/** The orders the task list can be shown in, as the menu lists them. */
export const TASK_SORTS: readonly { id: TaskSort; label: string }[] = [
  { id: "updated_desc", label: "Recently updated" },
  { id: "updated_asc", label: "Oldest first" },
  { id: "title_asc", label: "Title A-Z" },
  { id: "title_desc", label: "Title Z-A" },
];

/** The order used until someone chooses otherwise, and the fallback for a stored
 * value that names an order this version does not have */
export const DEFAULT_TASK_SORT: TaskSort = "updated_desc";

/** Whether a value names an order this version knows.
 *
 * A stored preference is untrusted input: it survives deploys, so it can name an
 * order that has since been removed, and it is editable by hand.
 *
 * @param value The candidate, usually parsed from storage.
 * @returns Whether it is a known order
 */
export function isTaskSort(value: unknown): value is TaskSort {
  return TASK_SORTS.some((sort) => sort.id === value);
}

/** Orders a list of tasks, leaving the input untouched.
 *
 * Comparison is against an explicit locale rather than the runtime's default.
 * This runs on the server for the first render and on the client for every one
 * after, and the two environments disagreeing about collation would put the same
 * tasks in two different orders - a hydration mismatch in the markup itself.
 *
 * @param tasks The tasks to order.
 * @param sort Which order to put them in.
 * @returns A new array, sorted.
 */
export function sortTasks(tasks: TaskDTO[], sort: TaskSort): TaskDTO[] {
  const sorted = [...tasks];

  switch (sort) {
    case "updated_desc":
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt, "en"));
    case "updated_asc":
      return sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt, "en"));
    case "title_asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, "en"));
    case "title_desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title, "en"));
  }
}

/** The cookie the chosen order is stored under. */
export const TASK_SORT_COOKIE = "vecta_task_sort";

/** Validates a stored sort order.
 *
 * The same function runs on the server and in the browser, so the two cannot
 * disagree about whether a stored order is one this version offers.
 *
 * @param raw The parsed cookie value.
 * @returns The order, or undefined when it is not one this version has.
 */
export function parseTaskSort(raw: unknown): TaskSort | undefined {
  return isTaskSort(raw) ? raw : undefined;
}
