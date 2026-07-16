"use client";

import { useMemo, useState } from "react";
import { ListIcon, Plus } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { useCollapsedSections } from "@/src/hooks/use-collapsed-sections";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import type { TaskDTO } from "@/src/lib/dtos/tasks";
import { TASK_STATUSES } from "@/src/lib/task-status";

import { TaskDialogPlaceholder } from "./task-dialog-placeholder";
import { TaskSection } from "./task-section";

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
  const [creating, setCreating] = useState(false);

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

  return (
    <section>
      <header className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-semibold tracking-[-0.02em]">Your tasks</h1>
          <p className="text-text-3 mt-1 text-[13.5px]">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} across {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
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

      <TaskDialogPlaceholder open={creating} onOpenChange={setCreating} />
    </section>
  );
}
