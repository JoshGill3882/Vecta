"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListIcon, Plus, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/src/shared/components/ui/button";
import { useCollapsedSections } from "@/src/features/tasks/hooks/use-collapsed-sections";
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
  isNarrowing,
  narrowTasks,
  normaliseQuery,
  type TaskNarrowing,
} from "@/src/features/tasks/lib/task-search";
import { tasksSearchFieldId } from "@/src/features/tasks/components/toolbar/search-field";
import { TasksToolbar } from "@/src/features/tasks/components/toolbar/tasks-toolbar";

/**
 * Focus target of last resort after a delete: with no tasks left there are no
 * section headers to return to, so the empty state's heading stands in (#110).
 */
const tasksEmptyStateHeadingId = "tasks-empty-state-heading";

/**
 * Copy for the no-results state. It names the controls actually narrowing the
 * list, so the message cannot blame a search when a filter is what emptied it,
 * and the action says exactly what will clear.
 */
function describeNoMatches(query: string, byCategory: boolean) {
  const trimmed = query.trim();
  if (trimmed && byCategory) {
    return {
      detail: `Nothing matches “${trimmed}” in the selected categories.`,
      action: "Clear search and filters",
    };
  }
  if (trimmed) return { detail: `Nothing matches “${trimmed}”.`, action: "Clear search" };
  return { detail: `No tasks in the selected categories.`, action: "Clear filters" };
}

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

  const [query, setQuery] = useState("");
  const needle = normaliseQuery(query);
  const [categoryIds, setCategoryIds] = useState<ReadonlySet<string | null>>(() => new Set());

  // A category can be deleted while it is selected, which would otherwise narrow
  // the list to nothing and leave no way back. Pruning is derived rather than
  // corrected after the fact: a correction applied afterwards shows the stranded
  // list for a render first, and races the refresh that removed the category.
  const selectedCategoryIds = useMemo(() => {
    const known = new Set<string | null>([null]);
    for (const category of categories) known.add(category.id);
    return new Set([...categoryIds].filter((id) => known.has(id)));
  }, [categoryIds, categories]);

  const narrowing = useMemo<TaskNarrowing>(
    () => ({ needle, categoryIds: selectedCategoryIds }),
    [needle, selectedCategoryIds]
  );
  const narrowed = isNarrowing(narrowing);

  // Clear all narrowing
  function clearNarrowing() {
    setQuery("");
    setCategoryIds(new Set());
  }

  // No Matches detail and action strings for current state
  const noMatches = describeNoMatches(query, selectedCategoryIds.size > 0);

  // Bucket once per data change rather than filtering the list once per section.
  // Most-recently-touched first, matching the design.
  const { byStatus, matchCount } = useMemo(() => {
    const matched = narrowTasks(tasks, narrowing);
    const buckets = new Map(TASK_STATUSES.map((status) => [status.id, [] as TaskDTO[]]));
    for (const task of matched) buckets.get(task.status)?.push(task);
    for (const bucket of buckets.values())
      bucket.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { byStatus: buckets, matchCount: matched.length };
  }, [tasks, narrowing]);

  // Collapsing a section while the list is narrowed is a transient act, so it is held here
  // rather than written to the persisted map - clearing the narrowing returns every
  // section to the state the user left it in. Sections start expanded,
  // since a match hidden inside a collapsed `closed` reads as no match.
  const [narrowCollapsed, setNarrowCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>({});

  // Reset the transient collapse when narrowing ends, whichever control ended it.
  // Adjusted during render rather than after it: React applies this before the
  // sections render, so they never see a map left over from the last time the
  // list was narrowed.
  const [wasNarrowed, setWasNarrowed] = useState(narrowed);
  if (wasNarrowed !== narrowed) {
    setWasNarrowed(narrowed);
    if (!narrowed) setNarrowCollapsed({});
  }

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
          <p role="status" className="text-text-3 mt-1 text-[13.5px]">
            {narrowed
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
          query={query}
          onQueryChange={setQuery}
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
          onSelectedCategoryIdsChange={setCategoryIds}
        />
      )}

      {tasks.length === 0 ? (
        <div className="text-text-2 px-5 py-[60px] text-center">
          <div className="bg-surface-2 text-text-3 mx-auto mb-4 flex size-14 items-center justify-center rounded-[14px] border">
            <ListIcon className="size-[26px]" />
          </div>
          <h2 id={tasksEmptyStateHeadingId} tabIndex={-1} className="mb-1.5 text-[17px]">
            No tasks yet
          </h2>
          <p className="text-text-3 text-sm">Create your first task with the New task button.</p>
        </div>
      ) : matchCount === 0 ? (
        <div className="text-text-2 px-5 py-[60px] text-center">
          <div className="bg-surface-2 text-text-3 mx-auto mb-4 flex size-14 items-center justify-center rounded-[14px] border">
            <SearchIcon className="size-[26px]" />
          </div>
          <h2 id={tasksEmptyStateHeadingId} tabIndex={-1} className="mb-1.5 text-[17px]">
            No matching tasks
          </h2>
          <p className="text-text-3 text-sm">{noMatches.detail}.</p>
          <Button variant="outline" onClick={clearNarrowing} className="mt-4">
            {noMatches.action}
          </Button>
        </div>
      ) : (
        TASK_STATUSES.map((status) => {
          const inStatus = byStatus.get(status.id) ?? [];
          // A status with nothing in it is noise while narrowing - drop it until the narrowing clears
          if (narrowed && inStatus.length === 0) return null;
          return (
            <TaskSection
              key={status.id}
              status={status.id}
              label={status.label}
              tasks={byStatus.get(status.id) ?? []}
              categoriesById={categoriesById}
              collapsed={narrowed ? (narrowCollapsed[status.id] ?? false) : collapsed[status.id]}
              onCollapsedChange={(next) =>
                narrowed
                  ? setNarrowCollapsed((prev) => ({ ...prev, [status.id]: next }))
                  : toggle(status.id)
              }
              onEdit={openEdit}
              onDelete={deleteTask}
              needle={needle}
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
