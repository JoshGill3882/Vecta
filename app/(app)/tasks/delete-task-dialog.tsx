"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import type { TaskDTO } from "@/src/lib/dtos/tasks";

/**
 * Confirmation step in front of a task deletion. Presentational and controlled:
 * it names the task and gathers the yes/no, but owns none of the delete itself.
 *
 * `onConfirm` resolves true when the task was deleted, which closes the dialog —
 * the same contract `TaskFormDialog` uses for save, so a failure keeps the
 * dialog open over the task the user was trying to remove rather than dismissing
 * as though it worked.
 */
export function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onConfirm,
}: {
  /** The task being deleted; named in the prompt. */
  task: TaskDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves true when the task was deleted, which closes the dialog. */
  onConfirm: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      const deleted = await onConfirm();
      if (deleted) onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete task</AlertDialogTitle>
          <AlertDialogDescription>
            Delete “{task.title}”? This permanently removes the task and can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/* Radix closes on cancel by default; disable it mid-delete so the two
              buttons can't both fire. */}
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* Not an AlertDialogAction: that auto-closes on click, which would tear
              the dialog down before the delete resolves. This closes on success
              via onConfirm instead. */}
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {pending ? "Deleting…" : "Delete task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
