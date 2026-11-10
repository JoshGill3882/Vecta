"use client";

import { CalendarIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import { cn } from "@/src/shared/lib/utils";
import { DUE_OPTIONS } from "@/src/features/tasks/components/toolbar/due-options";
import { FilterTrigger } from "@/src/features/tasks/components/toolbar/filter-trigger";
import { DUE_BUCKETS, type DueBucket } from "@/src/features/tasks/lib/due-date";
import { toggled } from "@/src/features/tasks/lib/selection";

/** Narrows the task list to the tasks in any of the selected due-date options.
 *
 * Built like the category menu, as checkboxes behind a button with a count,
 * so the two filters work the same way. Selecting nothing means no filter.
 */
export function DueFilter({
  selected,
  onSelectedChange,
}: {
  selected: ReadonlySet<DueBucket>;
  onSelectedChange: (next: ReadonlySet<DueBucket>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger icon={CalendarIcon} label="Due" count={selected.size} />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[206px]">
        {DUE_BUCKETS.map((bucket) => {
          const { label, icon: Icon, tone } = DUE_OPTIONS[bucket];
          return (
            <DropdownMenuCheckboxItem
              key={bucket}
              checked={selected.has(bucket)}
              onCheckedChange={() => onSelectedChange(toggled(selected, bucket))}
              onSelect={(event) => event.preventDefault()}
            >
              <Icon aria-hidden className={cn("size-[13px]", tone ?? "text-text-3")} />
              <span className={tone}>{label}</span>
            </DropdownMenuCheckboxItem>
          );
        })}

        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelectedChange(new Set())}>
              Clear due date
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
