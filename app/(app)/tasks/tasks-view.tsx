"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListIcon, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/src/components/ui/button";
import { useCollapsedSections } from "@/src/hooks/use-collapsed-sections";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import type { TaskDTO, TaskStatus } from "@/src/lib/dtos/tasks";
import { suggestCategoryColor } from "@/src/lib/palette";
import { TASK_STATUSES } from "@/src/lib/task-status";

import { createCategoryAction } from "../categories/actions";
import { createTaskAction, updateTaskAction, deleteTaskAction } from "./actions";
import { TaskFormDialog, type TaskFormValues } from "./task-form-dialog";
import { TaskSection, taskSectionHeaderId } from "./task-section";

/**
 * Tasks view — the content of the `/` route. Kept separate from page.tsx so the
 * route stays thin (auth + data fetching) while this owns the presentation.
 *
 * A Client Component, because the whole view is one interactive unit: the
 * collapsed sections read localStorage and the "New task" action owns dialog
 * state. Reads still happen on the server; the data arrives as props.
 */
export function TasksView({ tasks, categories }: { tasks: TaskDTO[]; categories: CategoryDTO[] }) {
  const { collapsed, toggle } = useCollapsedSections();
  const router = useRouter();

  // A successful delete unmounts the card that opened the confirm dialog, so its
  // focus has nowhere to return — the shared restore lands on `<body>`. Record
  // the deleted task's status and, once the refreshed list has rendered, move
  // focus to that section's header instead of leaving the user at the top (#50).
  const pendingSectionFocus = useRef<TaskStatus | null>(null);
  useEffect(() => {
    const status = pendingSectionFocus.current;
    if (!status) return;
    pendingSectionFocus.current = null;
    document.getElementById(taskSectionHeaderId(status))?.focus();
  }, [tasks]);

  // One dialog serves create and edit; `editing` is what tells them apart —
  // undefined creates, a task edits. The open flag is held separately from the
  // task because Radix keeps content mounted through the close animation:
  // clearing the task to close it would flip the dialog back to its create copy
  // for the duration of the fade.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDTO | undefined>(undefined);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  // Bucket once per data change rather than filtering the list once per section.
  // Most-recently-touched first, matching the design.
  const byStatus = useMemo(() => {
    const buckets = new Map(TASK_STATUSES.map((status) => [status.id, [] as TaskDTO[]]));
    for (const task of tasks) buckets.get(task.status)?.push(task);
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return buckets;
  }, [tasks]);

  async function saveTask(values: TaskFormValues): Promise<TaskDTO | null> {
    const result = editing
      ? await updateTaskAction(editing.id, values)
      : await createTaskAction(values);

    if (!result.ok) {
      toast.error(result.error);
      return null;
    }

    toast.success(editing ? "Changes saved" : "Task created");
    router.refresh();
    return result.data;
  }

  async function deleteTask(task: TaskDTO): Promise<boolean> {
    const result = await deleteTaskAction(task.id);

    if (!result.ok) {
      toast.error(result.error);
      return false;
    }

    toast.success("Task deleted");
    // Focus its section header once the refresh has re-rendered without the card.
    pendingSectionFocus.current = task.status;
    router.refresh();
    return true;
  }

  async function createCategory(name: string): Promise<CategoryDTO | null> {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", suggestCategoryColor(categories.length));

    const result = await createCategoryAction(null, formData);

    if (!result.ok) {
      toast.error(result.error);
      return null;
    }

    toast.success("Category created");
    router.refresh();
    return result.data;
  }

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(task: TaskDTO) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <section>
      {/* Stacks below `sm`. Side by side, the button is bottom-aligned to a
          subtitle whose line count varies with the data, so it sits at a
          different height on each page — and a subtitle that wraps squeezes the
          button as well, since neither this header nor Categories' reserves space
          for it. Stacking sidesteps both, and matches Categories. */}
      <header className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-[23px] font-semibold tracking-[-0.02em]">Your tasks</h1>
          <p className="text-text-3 mt-1 text-[13.5px]">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} across {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <Button size="lg" onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="size-4" />
          New task
        </Button>
      </header>

      {TASK_STATUSES.map((status) => (
        <TaskSection
          key={status.id}
          status={status.id}
          label={status.label}
          tasks={byStatus.get(status.id) ?? []}
          categoriesById={categoriesById}
          collapsed={collapsed[status.id]}
          onToggle={() => toggle(status.id)}
          onEdit={openEdit}
          onDelete={deleteTask}
        />
      ))}

      {tasks.length === 0 && (
        <div className="text-text-2 px-5 py-[60px] text-center">
          <div className="bg-surface-2 text-text-3 mx-auto mb-4 flex size-14 items-center justify-center rounded-[14px] border">
            <ListIcon className="size-[26px]" />
          </div>
          <h2 className="mb-1.5 text-[17px]">No tasks yet</h2>
          <p className="text-text-3 text-sm">Create your first task with the New task button.</p>
        </div>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        categories={categories}
        onSubmit={saveTask}
        onCreateCategory={createCategory}
      />
    </section>
  );
}
