"use client";

import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { CategoryFilter } from "@/src/features/tasks/components/toolbar/category-filter";
import { DueFilter } from "@/src/features/tasks/components/toolbar/due-filter";
import { FilterSheet } from "@/src/features/tasks/components/toolbar/filter-sheet";
import { SearchField } from "@/src/features/tasks/components/toolbar/search-field";
import { SortMenu } from "@/src/features/tasks/components/toolbar/sort-menu";
import type { DueBucket } from "@/src/features/tasks/lib/due-date";
import type { TaskSort } from "@/src/features/tasks/lib/task-sort";

/** The row of controls above the task list.
 *
 * Its own component because every such control belongs in this row, and
 * `tasks-view.tsx` already owns the derivation, the dialogs and the delete focus
 * handling. Growing the view by a control at a time is how it stops being readable.
 *
 * Two layouts, switched at the same 720px the nav tabs use. From there up, the
 * controls sit inline beside the search field and wrap below it if they run out
 * of room. Below it they fold into one button that opens a sheet: a phone has
 * room for the field and one button, and every control added to a wrapping row
 * costs another line above the list.
 */
export function TasksToolbar({
  query,
  onQueryChange,
  categories,
  selectedCategoryIds,
  onSelectedCategoryIdsChange,
  selectedDueBuckets,
  onSelectedDueBucketsChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  categories: CategoryDTO[];
  selectedCategoryIds: ReadonlySet<string | null>;
  onSelectedCategoryIdsChange: (next: ReadonlySet<string | null>) => void;
  selectedDueBuckets: ReadonlySet<DueBucket>;
  onSelectedDueBucketsChange: (next: ReadonlySet<DueBucket>) => void;
  sort: TaskSort;
  onSortChange: (sort: TaskSort) => void;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-2 min-[720px]:flex-wrap">
      <SearchField value={query} onChange={onQueryChange} />

      <FilterSheet
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onSelectedCategoryIdsChange={onSelectedCategoryIdsChange}
        sort={sort}
        onSortChange={onSortChange}
        className="min-[720px]:hidden"
      />

      {/* `contents` removes the wrapper's own box, so on desktop the controls
          are flex items of the row itself and wrap exactly as before. Due sits first
          of the filters, as the one that answers what needs attention now. */}
      <div className="hidden min-[720px]:contents">
        <DueFilter selected={selectedDueBuckets} onSelectedChange={onSelectedDueBucketsChange} />
        <CategoryFilter
          categories={categories}
          selected={selectedCategoryIds}
          onSelectedChange={onSelectedCategoryIdsChange}
        />
        <SortMenu value={sort} onChange={onSortChange} />
      </div>
    </div>
  );
}
