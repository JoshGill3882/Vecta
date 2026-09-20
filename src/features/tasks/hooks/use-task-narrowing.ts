"use client";

import { useMemo, useState } from "react";

import {
  isNarrowing,
  normaliseQuery,
  type TaskNarrowing,
} from "@/src/features/tasks/lib/task-search";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";

/** The narrowing controls' state, and the criteria they add up to. */
export interface TaskNarrowingState {
  /** The query as typed, before normalising. */
  query: string;
  setQuery: (query: string) => void;
  /** Selected category ids, pruned to those that still exist. */
  categoryIds: ReadonlySet<string | null>;
  setCategoryIds: (categoryIds: ReadonlySet<string | null>) => void;
  /** The criteria to narrow a task list by. */
  narrowing: TaskNarrowing;
  /** Whether any control is currently narrowing the list. */
  narrowed: boolean;
  /** Clears every control at once. */
  clear: () => void;
}

/** Owns what narrows the task list: the query and the selected categories.
 *
 * The selection is pruned against the categories that exist rather than
 * corrected once one goes missing. A category deleted while selected would
 * otherwise narrow the list to nothing and leave no way back, and correcting
 * that after the fact shows the stranded list for a render first and races the
 * refresh that removed the category.
 *
 * @param categories The categories that exist, which the selection is pruned
 *   against.
 * @returns The controls' state, the criteria they produce, and a clear.
 */
export function useTaskNarrowing(categories: CategoryDTO[]): TaskNarrowingState {
  const [query, setQuery] = useState("");
  const [categoryIds, setCategoryIds] = useState<ReadonlySet<string | null>>(() => new Set());

  const selected = useMemo(() => {
    const known = new Set<string | null>([null]);
    for (const category of categories) known.add(category.id);
    return new Set([...categoryIds].filter((id) => known.has(id)));
  }, [categoryIds, categories]);

  const needle = normaliseQuery(query);
  const narrowing = useMemo<TaskNarrowing>(
    () => ({ needle, categoryIds: selected }),
    [needle, selected]
  );

  return {
    query,
    setQuery,
    categoryIds: selected,
    setCategoryIds,
    narrowing,
    narrowed: isNarrowing(narrowing),
    clear: () => {
      setQuery("");
      setCategoryIds(new Set());
    },
  };
}
