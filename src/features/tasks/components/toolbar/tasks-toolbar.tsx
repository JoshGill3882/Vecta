"use client";

import { TaskSort } from "../../lib/task-sort";
import { CategoryFilter } from "./category-filter";
import { SearchField } from "./search-field";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { SortMenu } from "./sort-menu";

/**
 * The row of controls above the task list.
 *
 * Its own component because every such control belongs in this row, and
 * `tasks-view.tsx` already owns the derivation, the dialogs and the delete focus
 * handling. Growing the view by a control at a time is how it stops being readable.
 *
 * Wrapping rather than a breakpoint: the field claims the row and the controls
 * drop below it once they no longer fit, so the layout follows how many controls
 * there are rather than a guess about screen width.
 */
export function TasksToolbar({
  query,
  onQueryChange,
  categories,
  selectedCategoryIds,
  onSelectedCategoryIdsChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  categories: CategoryDTO[];
  selectedCategoryIds: ReadonlySet<string | null>;
  onSelectedCategoryIdsChange: (next: ReadonlySet<string | null>) => void;
  sort: TaskSort;
  onSortChange: (sort: TaskSort) => void;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <SearchField value={query} onChange={onQueryChange} />
      <CategoryFilter
        categories={categories}
        selected={selectedCategoryIds}
        onSelectedChange={onSelectedCategoryIdsChange}
      />
      <SortMenu value={sort} onChange={onSortChange} />
    </div>
  );
}
