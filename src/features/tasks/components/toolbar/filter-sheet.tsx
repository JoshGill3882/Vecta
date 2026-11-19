"use client";

import {
  FilterSheetFrame,
  OptionRow,
  SheetSection,
  summarise,
} from "@/src/shared/components/filter-sheet";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { DUE_OPTIONS } from "@/src/features/tasks/components/toolbar/due-options";
import { DUE_BUCKETS, type DueBucket } from "@/src/features/tasks/lib/due-date";
import { cn } from "@/src/shared/lib/utils";
import { toggled } from "@/src/shared/lib/selection";
import { TASK_SORTS, type TaskSort } from "@/src/features/tasks/lib/task-sort";

/** `null` is the Uncategorised option, matching how a task stores its absence. */
type Selection = ReadonlySet<string | null>;

/** A due-date option's colour, given up for the row's own text while the row is
 * highlighted, as the desktop menu does: against the highlight, the overdue red
 * falls short of 4.5:1.
 *
 * @param tone The option's colour class, if it has one.
 * @returns The classes for its icon and label, or nothing for an uncoloured option.
 */
function toneOnRow(tone: string | undefined): string | undefined {
  if (!tone) return undefined;
  return cn(tone, "group-hover/option:text-inherit group-has-focus-visible/option:text-inherit");
}

/** Every filter and the sort order behind one button, for screens too narrow to hold them in a row.
 *
 * Each section collapses, and all start closed, so however many categories
 * exist the sheet opens as one short row per section, with Sort by never
 * pushed below a long list. Section order matches the desktop toolbar.
 */
export function FilterSheet({
  categories,
  selectedCategoryIds,
  onSelectedCategoryIdsChange,
  selectedDueBuckets,
  onSelectedDueBucketsChange,
  sort,
  onSortChange,
  className,
}: {
  categories: CategoryDTO[];
  selectedCategoryIds: Selection;
  onSelectedCategoryIdsChange: (next: Selection) => void;
  selectedDueBuckets: ReadonlySet<DueBucket>;
  onSelectedDueBucketsChange: (next: ReadonlySet<DueBucket>) => void;
  sort: TaskSort;
  onSortChange: (sort: TaskSort) => void;
  className?: string;
}) {
  // Sort is left out: it reorders the list rather than narrowing it, so it
  // never hides anything a reader would need the badge to explain.
  const active = selectedDueBuckets.size + selectedCategoryIds.size;

  /** Names a selected category, or Uncategorised for `null`.
   *
   * @param id The selected option.
   * @returns Its display name.
   */
  function categoryName(id: string | null) {
    if (id === null) return "Uncategorised";
    return categories.find((category) => category.id === id)?.name ?? "";
  }

  /** Clears every filter, leaving the sort as it is. */
  function clearFilters() {
    onSelectedDueBucketsChange(new Set());
    onSelectedCategoryIdsChange(new Set());
  }

  const sortLabel = (TASK_SORTS.find((option) => option.id === sort) ?? TASK_SORTS[0]).label;

  return (
    <FilterSheetFrame
      label="Filter and sort"
      title="Filter and Sort"
      active={active}
      onClear={clearFilters}
      className={className}
    >
      <SheetSection
        title="Due"
        summary={summarise(selectedDueBuckets, (bucket) => DUE_OPTIONS[bucket].label)}
      >
        {DUE_BUCKETS.map((bucket) => {
          const { label, icon: Icon, tone } = DUE_OPTIONS[bucket];
          return (
            <OptionRow
              key={bucket}
              type="checkbox"
              checked={selectedDueBuckets.has(bucket)}
              onChange={() => onSelectedDueBucketsChange(toggled(selectedDueBuckets, bucket))}
            >
              <Icon
                aria-hidden
                className={cn("size-3.5 shrink-0", toneOnRow(tone) ?? "text-text-3")}
              />
              <span className={toneOnRow(tone)}>{label}</span>
            </OptionRow>
          );
        })}
      </SheetSection>

      <SheetSection title="Category" summary={summarise(selectedCategoryIds, categoryName)}>
        {categories.map((category) => (
          <OptionRow
            key={category.id}
            type="checkbox"
            checked={selectedCategoryIds.has(category.id)}
            onChange={() => onSelectedCategoryIdsChange(toggled(selectedCategoryIds, category.id))}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="truncate">{category.name}</span>
          </OptionRow>
        ))}
        <OptionRow
          type="checkbox"
          checked={selectedCategoryIds.has(null)}
          onChange={() => onSelectedCategoryIdsChange(toggled(selectedCategoryIds, null))}
        >
          <span className="border-text-faint size-2 shrink-0 rounded-full border border-dashed" />
          <span className="truncate">Uncategorised</span>
        </OptionRow>
      </SheetSection>

      <SheetSection title="Sort by" summary={sortLabel}>
        <fieldset>
          <legend className="sr-only">Sort by</legend>
          {TASK_SORTS.map((option) => (
            <OptionRow
              key={option.id}
              type="radio"
              name="task-sort"
              checked={sort === option.id}
              onChange={() => onSortChange(option.id)}
            >
              {option.label}
            </OptionRow>
          ))}
        </fieldset>
      </SheetSection>
    </FilterSheetFrame>
  );
}
