"use client";

import { Dialog, DialogContent } from "@/src/shared/components/ui/dialog";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

import { TaskDialogBody } from "@/src/features/tasks/components/dialog/task-dialog-body";
import type { TaskFormValues } from "@/src/features/tasks/components/dialog/task-form";
import { useVisibleViewport } from "@/src/features/tasks/hooks/use-visible-viewport";

// Re-exported so callers reach the dialog and the shape it submits through one
// module, rather than having to know the form is a separate file.
export type { TaskFormValues };

/** The task dialog: one window serving both viewing a task and editing one. */
export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  categories,
  onSubmit,
  onCreateCategory,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omitted for create; supplied for edit, which opens in view mode over it. */
  task?: TaskDTO;
  categories: CategoryDTO[];
  /**
   * Persists the task and resolves the saved row — the fresh DTO, so view mode
   * can show the new state (create included) without waiting on a refetch — or
   * `null` when the save failed, which keeps the form open with its errors.
   */
  onSubmit: (values: TaskFormValues) => Promise<TaskDTO | null>;
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
  /** Resolves true when the task was deleted, which closes the dialog */
  onDelete: (task: TaskDTO) => Promise<boolean>;
}) {
  const visible = useVisibleViewport();

  /** Deletes the task and, on success, closes the dialog over it.
   *
   * @param task The task being viewed.
   * @returns Whether it was deleted.
   */
  async function deleteAndClose(task: TaskDTO): Promise<boolean> {
    const deleted = await onDelete(task);
    if (deleted) onOpenChange(false);
    return deleted;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Null on a mouse, so desktop keeps the `dvh` sizing below untouched. On
        // touch this pins the dialog to the space the keyboard leaves, using the
        // same 7%/86% proportions — `offsetTop` included because iOS pans the
        // visual viewport rather than resizing it, and a fixed element has to
        // follow that pan or it drifts off screen.
        style={
          visible
            ? { top: visible.offsetTop + visible.height * 0.07, maxHeight: visible.height * 0.86 }
            : undefined
        }
        // The design gives the dialog no prose description, and Radix only stops
        // warning about the missing `aria-describedby` when it's cleared.
        aria-describedby={undefined}
        // The close button is the first tabbable in the content, so Radix's
        // default would land focus there. Never let it: this always takes over.
        //
        // Only the edit form has a field to prime, and even then only with a
        // mouse: on touch, focusing any field throws the keyboard up over the
        // form before the user has chosen one. So focus the title input only on
        // a fine pointer when it exists (edit mode) — otherwise (view mode, or
        // touch) focus the dialog itself. It carries tabIndex={-1}, which keeps
        // the dialog announced and gives the focus trap a start without priming
        // an input. Cancelling without focusing anything would strand focus on
        // the trigger behind the dialog — silent on a phone, broken for a reader.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const title = document.getElementById("task-title");
          if (title && !window.matchMedia("(pointer: coarse)").matches) {
            title.focus();
            return;
          }
          (event.currentTarget as HTMLElement).focus();
        }}
        // `dvh`, not `vh`: `vh` is the viewport with the browser chrome retracted
        // and ignores the on-screen keyboard entirely, so on a phone the dialog is
        // sized to more space than it can see and the footer actions sit below the
        // fold, under the keyboard. `dvh` tracks the space actually visible.
        className="top-[7dvh] flex max-h-[86dvh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        {/* Radix unmounts dialog content on close, so this remounts on each open —
            mode and the shown task both start fresh from `task`, with no reset. */}
        <TaskDialogBody
          task={task}
          categories={categories}
          onSubmit={onSubmit}
          onCreateCategory={onCreateCategory}
          onOpenChange={onOpenChange}
          onDelete={deleteAndClose}
        />
      </DialogContent>
    </Dialog>
  );
}
