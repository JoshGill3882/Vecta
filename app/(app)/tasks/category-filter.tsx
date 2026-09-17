"use client";

import { ChevronDownIcon, TagIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import type { CategoryDTO } from "@/src/lib/dtos/categories";

/** `null` is the Uncategorised option, matching how a task stores its absence. */
type Selection = ReadonlySet<string | null>;

/**
 * Narrows the task list to a set of categories. A menu of checkboxes rather than
 * a row of chips: the number of categories is unbounded, and chips would push the
 * toolbar's width around as they are picked.
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
  function toggle(id: string | null) {
    const next = new Set(selected);
    // delete reports whether it removed anything, so one call covers both ways.
    if (!next.delete(id)) next.add(id);
    onSelectedChange(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={selected.size > 0 ? "secondary" : "outline"}>
          <TagIcon />
          Category
          {selected.size > 0 && (
            <span className="bg-foreground/10 min-w-[18px] rounded-full px-1.5 text-[11px] leading-[18px] font-semibold">
              {selected.size}
            </span>
          )}
          <ChevronDownIcon className="text-text-3 transition-transform duration-150 group-aria-expanded/button:rotate-180" />
        </Button>
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
