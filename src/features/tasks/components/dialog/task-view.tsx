import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { CategoryChip } from "@/src/shared/components/category-chip";
import { StatusBadge } from "@/src/features/tasks/components/status-badge";
import { DeleteTaskDialog } from "@/src/features/tasks/components/list/delete-task-dialog";
import { Button } from "@/src/shared/components/ui/button";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import { relativeTime } from "@/src/features/tasks/lib/relative-time";

import { TaskDescription } from "./task-description";

/**
 * Read/view mode — the modal's default state for an existing task, and where a
 * save lands. The list card carries no description preview, so this is the one
 * place a task's Markdown description is shown. The Edit button hands control to
 * the form; the header (with its title and close affordance) is the dialog's.
 */
export function TaskView({
  task,
  category,
  onEdit,
  onClose,
  onDelete,
}: {
  task: TaskDTO;
  category?: CategoryDTO;
  onEdit: () => void;
  onClose: () => void;
  onDelete: (task: TaskDTO) => Promise<boolean>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">
        <div className="mb-[18px] flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {category && <CategoryChip name={category.name} color={category.color} />}
          <span className="flex-1" />
          {/* Same clock-derived timestamp as the card, so the server and client
              renders can differ by a tick — suppress that one warning. */}
          <time
            dateTime={task.updatedAt}
            className="text-text-faint text-[11.5px]"
            suppressHydrationWarning
          >
            {relativeTime(task.updatedAt)}
          </time>
        </div>

        <p className="text-text-2 mb-[7px] text-[12.5px] font-medium">Description</p>
        {task.description.trim() ? (
          <TaskDescription markdown={task.description} />
        ) : (
          <p className="text-text-faint text-[14px] italic">No description.</p>
        )}
      </div>

      {/* Delete sits alone on the left, away from Edit - the button pressed
          most often - so a destructive action is never one slip away. */}
      <div className="flex shrink-0 items-center gap-2 border-t px-[18px] py-3.5">
        <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="size-[15px]" />
          Delete
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Rendered inside the task dialog so it stacks over it: Radix pauses the
          outer focus trap while this one is open, and cancelling returns focus
          to the Delete button. */}
      <DeleteTaskDialog
        task={task}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => onDelete(task)}
      />
    </>
  );
}
