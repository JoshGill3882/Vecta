"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import type { TaskDTO } from "@/src/lib/dtos/tasks";

import { DeleteTaskDialog } from "./delete-task-dialog";

/**
 * The task card's ⋮ overflow menu: edit the task, or delete it behind a
 * confirmation step. Delete opens the confirm dialog rather than acting
 * directly, so no task leaves without passing through it.
 */
export function TaskCardMenu({
  task,
  onEdit,
  onDelete,
}: {
  task: TaskDTO;
  onEdit: (task: TaskDTO) => void;
  /** Resolves true when the task was deleted, which closes the confirm dialog. */
  onDelete: (task: TaskDTO) => Promise<boolean>;
}) {
  // The menu and the confirm dialog are held apart: both are Radix layers that
  // trap focus, so the menu must fully close before the dialog opens or they
  // fight over it. onSelect closes the menu; opening the dialog waits a frame.
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteTaskDialog
        task={task}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => onDelete(task)}
      />
    </>
  );
}
