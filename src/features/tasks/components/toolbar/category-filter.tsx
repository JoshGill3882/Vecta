"use client";

import { TagIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { FilterTrigger } from "@/src/features/tasks/components/toolbar/filter-trigger";
import { toggled } from "@/src/features/tasks/lib/selection";

/** `null` is the Uncategorised option, matching how a task stores its absence. */
type Selection = ReadonlySet<string | null>;

/** Narrows the task list to a set of categories.
 *
 * A menu of checkboxes rather than a row of chips: the number of categories is
 * unbounded, and chips would push the toolbar's width around as they are
 * picked.
 *
 * Selecting nothing means no filter, so the menu always offers Uncategorised even
 * with no categories defined - a control whose only state hides the list would be
 * worse than no control.
 */
export function CategoryFilter({
  categories,
  selected,
  onSelectedChange,
}: {
  categories: CategoryDTO[];
  selected: Selection;
  onSelectedChange: (next: Selection) => void;
}) {
  /** Adds the category to the selection, or removes it when already there.
   *
   * @param id The category, or null for the Uncategorised option.
   */
  function toggle(id: string | null) {
    onSelectedChange(toggled(selected, id));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger icon={TagIcon} label="Category" count={selected.size} />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-[280px] w-[232px]">
        {categories.map((category) => (
          <DropdownMenuCheckboxItem
            key={category.id}
            checked={selected.has(category.id)}
            onCheckedChange={() => toggle(category.id)}
            onSelect={(event) => event.preventDefault()}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="truncate">{category.name}</span>
          </DropdownMenuCheckboxItem>
        ))}

        {categories.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuCheckboxItem
          checked={selected.has(null)}
          onCheckedChange={() => toggle(null)}
          onSelect={(event) => event.preventDefault()}
        >
          <span className="border-text-faint size-2 shrink-0 rounded-full border border-dashed" />
          <span className="truncate">Uncategorised</span>
        </DropdownMenuCheckboxItem>

        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelectedChange(new Set())}>
              Clear categories
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
