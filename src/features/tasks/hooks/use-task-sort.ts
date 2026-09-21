"use client";

import { createPersistedValue } from "@/src/shared/hooks/use-persisted-value";
import {
  DEFAULT_TASK_SORT,
  parseTaskSort,
  TASK_SORT_COOKIE,
} from "@/src/features/tasks/lib/task-sort";

/** The task list's order, remembered across reloads and shared across tabs. */
export const useTaskSort = createPersistedValue(TASK_SORT_COOKIE, parseTaskSort, DEFAULT_TASK_SORT);
