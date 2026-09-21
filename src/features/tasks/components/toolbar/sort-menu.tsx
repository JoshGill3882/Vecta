"use client";

import { ArrowUpDown, ChevronDownIcon } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import { TASK_SORTS, type TaskSort } from "@/src/features/tasks/lib/task-sort";

/** Chooses the order the task list is shown in.
 *
 * The trigger carries the active order's label rather than a static word. An
 * order chosen weeks ago has to explain itself, and a control reading "Sort"
 * makes the reader open it to find out what it is already doing.
 *
 * Radio rows rather than checkboxes, because exactly one order applies - and
 * unlike the category filter, choosing one closes the menu, since there is
 * nothing further to pick.
 */
export function SortMenu({
  value,
  onChange,
}: {
  value: TaskSort;
  onChange: (sort: TaskSort) => void;
}) {
  const active = TASK_SORTS.find((sort) => sort.id === value) ?? TASK_SORTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <ArrowUpDown />
          {active.label}
          <ChevronDownIcon className="text-text-3 transition-transform duration-150 group-aria-expanded/button:rotate-180" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[232px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as TaskSort)}>
          {TASK_SORTS.map((sort) => (
            <DropdownMenuRadioItem key={sort.id} value={sort.id}>
              {sort.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
