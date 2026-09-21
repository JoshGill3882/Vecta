"use client";

import { useState } from "react";
import { FileText, Pencil, Plus, X } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import { DialogClose, DialogTitle } from "@/src/shared/components/ui/dialog";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

import { TaskForm, type TaskFormValues } from "@/src/features/tasks/components/dialog/task-form";
import { TaskView } from "@/src/features/tasks/components/dialog/task-view";

/** The dialog contents: its header, and whichever of view or edit is showing.
 *
 * Held apart from the dialog shell because the shell is about the window - its
 * sizing, its focus behaviour, the space a keyboard leaves it - while this is
 * about which of a task's two faces the reader is looking at.
 */
export function TaskDialogBody({
  task,
  categories,
  onSubmit,
  onCreateCategory,
  onOpenChange,
}: {
  task?: TaskDTO;
  categories: CategoryDTO[];
  onSubmit: (values: TaskFormValues) => Promise<TaskDTO | null>;
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
  onOpenChange: (open: boolean) => void;
}) {
  // An existing task opens in view; create opens straight in the form. `current`
  // is the task on screen: a save swaps in the returned DTO so view mode reflects
  // the new state, and a created task then has a row to view and re-edit.
  const [current, setCurrent] = useState(task);
  const [mode, setMode] = useState<"view" | "edit">(task ? "view" : "edit");

  const category = current ? categories.find((c) => c.id === current.categoryId) : undefined;

  const headerIcon =
    mode === "view" ? (
      <FileText className="size-4" />
    ) : current ? (
      <Pencil className="size-4" />
    ) : (
      <Plus className="size-4" />
    );
  const headerTitle = mode === "view" ? (current?.title ?? "") : current ? "Edit task" : "New task";

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2.5 border-b px-[18px] py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary/15 text-primary flex size-[30px] shrink-0 items-center justify-center rounded-lg">
            {headerIcon}
          </span>
          <DialogTitle className="line-clamp-2 text-base leading-tight font-semibold tracking-[-0.01em]">
            {headerTitle}
          </DialogTitle>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close" className="shrink-0">
            <X />
          </Button>
        </DialogClose>
      </div>

      {mode === "view" && current ? (
        <TaskView
          task={current}
          category={category}
          onEdit={() => setMode("edit")}
          onClose={() => onOpenChange(false)}
        />
      ) : (
        <TaskForm
          task={current}
          categories={categories}
          onSubmit={onSubmit}
          onCreateCategory={onCreateCategory}
          // A save reveals the fresh row in view mode. On failure onSubmit
          // resolves null, so the form stays put with its inline errors.
          onSaved={(saved) => {
            setCurrent(saved);
            setMode("view");
          }}
          // Cancel steps back to view when there's a task to return to; a brand
          // new task has none, so it closes the dialog instead.
          onCancel={() => (current ? setMode("view") : onOpenChange(false))}
        />
      )}
    </>
  );
}
