"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { cn } from "@/src/shared/lib/utils";
import { DUE_OPTIONS } from "@/src/features/tasks/components/toolbar/due-options";
import { tasksSearchFieldId } from "@/src/features/tasks/components/toolbar/search-field";
import type { TaskNarrowingState } from "@/src/features/tasks/hooks/use-task-narrowing";
import { DUE_BUCKETS } from "@/src/features/tasks/lib/due-date";
import { toggled } from "@/src/features/tasks/lib/selection";

/** Moves focus somewhere that will still exist, then runs the removal.
 *
 * The control being pressed is about to unmount, which would drop focus onto
 * the page. A neighbouring chip survives the re-render, since chips are keyed;
 * when none is left the whole row goes, so focus returns to the search field.
 *
 * @param event The click on the control that is about to disappear.
 * @param remove What the control does.
 */
function refocusThen(event: MouseEvent<HTMLButtonElement>, remove: () => void) {
  const item = event.currentTarget.closest("li");
  const neighbour = item?.nextElementSibling ?? item?.previousElementSibling;
  const target = neighbour?.querySelector("button") ?? document.getElementById(tasksSearchFieldId);
  target?.focus();
  remove();
}

/** One removable chip in the row. */
function FilterChip({
  name,
  onRemove,
  className,
  style,
  children,
}: {
  /** What the remove button says it removes, such as "Overdue filter". */
  name: string;
  /** Drops this one criterion. */
  onRemove: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "bg-surface-2 text-text-2 inline-flex max-w-60 shrink-0 items-center gap-1.5 rounded-full border py-[3px] pr-[5px] pl-[9px] text-[12.5px] font-medium",
        className
      )}
      style={style}
    >
      {children}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={(event) => refocusThen(event, onRemove)}
        className="text-text-3 hover:text-foreground focus-visible:ring-ring flex shrink-0 rounded-full p-0.5 outline-none focus-visible:ring-2 pointer-coarse:p-1.5"
      >
        <X aria-hidden className="size-3" />
      </button>
    </li>
  );
}

/** A chip for each thing narrowing the task list, each removable on its own,
 * with Clear all at the end.
 *
 * The toolbar's buttons count what is selected; this names it, and takes one
 * click to undo instead of opening a menu. Chips follow the menus' order rather
 * than the order they were picked, so a chip does not move as others come and
 * go.
 *
 * Wide screens wrap the chips. Narrow ones keep them to one line that scrolls
 * sideways, with Clear all pinned outside the scroll: the row then always
 * costs one line above the list, however much is selected.
 */
export function ActiveFilters({
  narrowing,
  categories,
}: {
  narrowing: TaskNarrowingState;
  categories: CategoryDTO[];
}) {
  if (!narrowing.narrowed) return null;

  const { query, categoryIds, dueBuckets } = narrowing;
  const trimmed = query.trim();

  return (
    <div className="mb-4 flex items-center gap-2">
      {/* The padding and matching negative margin give focus rings room inside
          the scroll container, which would otherwise clip them. */}
      <ul
        aria-label="Active filters"
        className="-m-1 flex min-w-0 flex-initial gap-2 overflow-x-auto p-1 min-[720px]:flex-wrap min-[720px]:overflow-visible"
      >
        {trimmed && (
          <FilterChip name={`search “${trimmed}”`} onRemove={() => narrowing.setQuery("")}>
            <span className="truncate">“{trimmed}”</span>
          </FilterChip>
        )}

        {DUE_BUCKETS.filter((bucket) => dueBuckets.has(bucket)).map((bucket) => {
          const { label, icon: Icon, tone } = DUE_OPTIONS[bucket];
          return (
            <FilterChip
              key={bucket}
              name={`${label} filter`}
              onRemove={() => narrowing.setDueBuckets(toggled(dueBuckets, bucket))}
              className={tone}
            >
              <Icon aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{label}</span>
            </FilterChip>
          );
        })}

        {categories
          .filter((category) => categoryIds.has(category.id))
          .map((category) => (
            // Coloured like the category's chip on a card, whose contrast is
            // accepted as it stands for the darker category colours.
            <FilterChip
              key={category.id}
              name={`${category.name} filter`}
              onRemove={() => narrowing.setCategoryIds(toggled(categoryIds, category.id))}
              style={{ color: category.color }}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="truncate">{category.name}</span>
            </FilterChip>
          ))}

        {categoryIds.has(null) && (
          <FilterChip
            name="Uncategorised filter"
            onRemove={() => narrowing.setCategoryIds(toggled(categoryIds, null))}
          >
            <span className="border-text-faint size-2 shrink-0 rounded-full border border-dashed" />
            <span className="truncate">Uncategorised</span>
          </FilterChip>
        )}
      </ul>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(event) => refocusThen(event, narrowing.clear)}
        className="text-text-3 shrink-0"
      >
        Clear all
      </Button>
    </div>
  );
}
