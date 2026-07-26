"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CategoryChip } from "@/src/components/categories/category-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import type { CategoryDTO } from "@/src/lib/dtos/categories";

import { deleteCategoryAction } from "./actions";

/** One row of the category list: chip, task count, and the edit/delete controls. */
export function CategoryRow({
  category,
  taskCount,
  onEdit,
  onDeleted,
}: {
  category: CategoryDTO;
  taskCount: number;
  onEdit: () => void;
  /**
   * Fired after a successful delete. The row (and the Delete button that opened
   * the confirm dialog) unmounts on refresh, so the parent restores focus to a
   * landmark that survives rather than letting it fall to `<body>` (#50).
   */
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // `deleteCategoryAction` takes a bare id — it isn't driven by useActionState,
  // so it's called directly inside a transition to get a pending flag.
  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`“${category.name}” deleted`);
      setConfirming(false);
      onDeleted();
      router.refresh();
    });
  }

  return (
    <div className="border-border/60 hover:bg-surface-2/60 flex items-center gap-3 border-b px-4 py-[13px] transition-colors last:border-b-0">
      <CategoryChip name={category.name} color={category.color} />
      <span className="flex-1" />
      <span className="text-text-faint text-[12.5px]">
        {taskCount} {taskCount === 1 ? "task" : "tasks"}
      </span>

      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label={`Edit ${category.name}`}
          title="Edit"
        >
          <Pencil className="size-[15px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${category.name}`}
          title="Delete"
        >
          <Trash2 className="size-[15px]" />
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskCount === 0
                ? "No tasks use this category."
                : `${taskCount} ${taskCount === 1 ? "task" : "tasks"} won't be deleted — they'll just become uncategorised.`}{" "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                // Keep the dialog mounted while the action is in flight, so the
                // pending state is visible and an error can be surfaced.
                e.preventDefault();
                confirmDelete();
              }}
            >
              {pending ? "Deleting…" : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
