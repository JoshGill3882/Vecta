"use client";

import { MoreVertical, Pencil } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import type { TaskDTO } from "@/src/lib/dtos/tasks";

/**
 * The task card's ⋮ overflow menu. Edit is the only action it carries today;
 * the design's delete item arrives with the delete issue, which owns both the
 * item and the confirmation step behind it.
 */
export function TaskCardMenu({ task, onEdit }: { task: TaskDTO; onEdit: (task: TaskDTO) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-text-3 -mt-0.5 -mr-1 shrink-0"
          aria-label={`Actions for ${task.title}`}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[184px]">
        <DropdownMenuItem onSelect={() => onEdit(task)}>
          <Pencil />
          Edit task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
