"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";

/**
 * Stand-in for the task create/edit dialog, which is built in its own issue.
 * It exists so the "New task" action has somewhere real to go — the shape of
 * the form (segmented status control, category select, markdown description)
 * is settled in the design, not here. Replace this file wholesale; nothing but
 * `tasks-view.tsx` refers to it.
 */
export function TaskDialogPlaceholder({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            The task form isn&apos;t built yet — it arrives with the create/edit issue. This
            placeholder confirms the action wiring.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
