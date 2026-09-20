"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListIcon, Plus, SearchIcon } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import { useServerAction } from "@/src/shared/hooks/use-server-action";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskDTO, TaskStatus } from "@/src/shared/lib/dtos/tasks";
import { suggestCategoryColor } from "@/src/shared/lib/palette";
import { TASK_STATUSES } from "@/src/shared/lib/task-status";

import { createCategoryAction } from "@/src/features/categories/actions";
import { createTaskAction, updateTaskAction, deleteTaskAction } from "@/src/features/tasks/actions";
import {
  TaskFormDialog,
  type TaskFormValues,
} from "@/src/features/tasks/components/dialog/task-form-dialog";
import {
  TaskSection,
  taskSectionHeaderId,
} from "@/src/features/tasks/components/list/task-section";
import {
  describeNoMatches,
  TasksEmptyState,
  tasksEmptyStateHeadingId,
} from "@/src/features/tasks/components/tasks-empty-state";
import { tasksSearchFieldId } from "@/src/features/tasks/components/toolbar/search-field";
import { TasksToolbar } from "@/src/features/tasks/components/toolbar/tasks-toolbar";
import { useSectionCollapse } from "@/src/features/tasks/hooks/use-section-collapse";
import { useTaskNarrowing } from "@/src/features/tasks/hooks/use-task-narrowing";
import { narrowTasks } from "@/src/features/tasks/lib/task-search";

/**
 * Tasks view — the content of the `/` route. Kept separate from page.tsx so the
 * route stays thin (auth + data fetching) while this owns the presentation.
 *
 * A Client Component, because the whole view is one interactive unit: the
 * collapsed sections read localStorage and the "New task" action owns dialog
 * state. Reads still happen on the server; the data arrives as props.
 */
export function TasksView({ tasks, categories }: { tasks: TaskDTO[]; categories: CategoryDTO[] }) {
  const runAction = useServerAction();
  const narrowing = useTaskNarrowing(categories);
  const sections = useSectionCollapse(narrowing.narrowed);

  // A successful delete unmounts the card that opened the confirm dialog, so its
  // focus has nowhere to return — the shared restore lands on `<body>`. Record
  // the deleted task's status and, once the refreshed list has rendered, move
  // focus to that section's header instead of leaving the user at the top.
  const pendingSectionFocus = useRef<TaskStatus | null>(null);
  useEffect(() => {
    const status = pendingSectionFocus.current;
    if (!status) return;
    pendingSectionFocus.current = null;
    const target =
      document.getElementById(taskSectionHeaderId(status)) ??
      document.getElementById(tasksEmptyStateHeadingId) ??
      document.getElementById(tasksSearchFieldId);
    target?.focus();
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
  const { byStatus, matchCount } = useMemo(() => {
    const matched = narrowTasks(tasks, narrowing.narrowing);
    const buckets = new Map(TASK_STATUSES.map((status) => [status.id, [] as TaskDTO[]]));
    for (const task of matched) buckets.get(task.status)?.push(task);
    for (const bucket of buckets.values())
      bucket.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { byStatus: buckets, matchCount: matched.length };
  }, [tasks, narrowing.narrowing]);

  /** Creates or updates a task, depending on whether one is being edited.
   *
   * @param values The submitted form values.
   * @returns The saved task, or null if the save failed.
   */
  function saveTask(values: TaskFormValues): Promise<TaskDTO | null> {
    return runAction(editing ? updateTaskAction(editing.id, values) : createTaskAction(values), {
      success: editing ? "Changes saved" : "Task created",
    });
  }

  /** Deletes a task and aims focus at the section it lived under.
   *
   * @param task The task to delete.
   * @returns Whether it was deleted, which is what closes the confirm dialog.
   */
  async function deleteTask(task: TaskDTO): Promise<boolean> {
    const deleted = await runAction(deleteTaskAction(task.id), {
      success: "Task deleted",
      // Recorded before the refresh, because the card holding focus is gone once
      // the list re-renders.
      beforeRefresh: () => {
        pendingSectionFocus.current = task.status;
      },
    });
    return deleted !== null;
  }

  /** Creates a category from the task dialog, colouring it from the palette.
   *
   * @param name The new category name.
   * @returns The created category, or null if it failed.
   */
  function createCategory(name: string): Promise<CategoryDTO | null> {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", suggestCategoryColor(categories.length));

    return runAction(createCategoryAction(null, formData), { success: "Category created" });
  }

  /** Opens the task dialog with no task loaded, ready to create one. */
  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  /** Opens the task dialog on an existing task.
   *
   * @param task The task to show.
   */
  function openEdit(task: TaskDTO) {
    setEditing(task);
    setFormOpen(true);
  }

  const noMatches = describeNoMatches(narrowing.query, narrowing.categoryIds.size > 0);

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
          <p role="status" className="text-text-3 mt-1 text-[13.5px]">
            {narrowing.narrowed
              ? `${matchCount} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
              : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} across ${categories.length} ${categories.length === 1 ? "category" : "categories"}`}
          </p>
        </div>
        <Button size="lg" onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="size-4" />
          New task
        </Button>
      </header>

      {tasks.length > 0 && (
        <TasksToolbar
          query={narrowing.query}
          onQueryChange={narrowing.setQuery}
          categories={categories}
          selectedCategoryIds={narrowing.categoryIds}
          onSelectedCategoryIdsChange={narrowing.setCategoryIds}
        />
      )}

      {tasks.length === 0 ? (
        <TasksEmptyState icon={ListIcon} heading="No tasks yet">
          Create your first task with the New task button.
        </TasksEmptyState>
      ) : matchCount === 0 ? (
        <TasksEmptyState
          icon={SearchIcon}
          heading="No matching tasks"
          action={{ label: noMatches.action, onClick: narrowing.clear }}
        >
          {noMatches.detail}
        </TasksEmptyState>
      ) : (
        TASK_STATUSES.map((status) => {
          const inStatus = byStatus.get(status.id) ?? [];
          // A status with nothing in it is noise while narrowing - drop it until the narrowing clears
          if (narrowing.narrowed && inStatus.length === 0) return null;
          return (
            <TaskSection
              key={status.id}
              status={status.id}
              label={status.label}
              tasks={inStatus}
              categoriesById={categoriesById}
              collapsed={sections.isCollapsed(status.id)}
              onCollapsedChange={(next) => sections.setCollapsed(status.id, next)}
              onEdit={openEdit}
              onDelete={deleteTask}
              needle={narrowing.narrowing.needle}
            />
          );
        })
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
