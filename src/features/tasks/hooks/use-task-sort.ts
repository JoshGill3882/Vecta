"use client";

import { createPersistedValue } from "@/src/shared/hooks/use-persisted-value";
import { DEFAULT_TASK_SORT, isTaskSort, type TaskSort } from "@/src/features/tasks/lib/task-sort";

/** The task list's order, remembered across reloads and shared across tabs. */
export const useTaskSort = createPersistedValue<TaskSort>(
  "vecta_task_sort",
  (raw) => (isTaskSort(raw) ? raw : undefined),
  DEFAULT_TASK_SORT
);
