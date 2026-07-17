"use client";

import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/components/ui/collapsible";
import type { CategoryDTO } from "@/src/lib/dtos/categories";
import type { TaskDTO, TaskStatus } from "@/src/lib/dtos/tasks";
import { STATUS_ACCENT } from "@/src/lib/task-status";
import { cn } from "@/src/lib/utils";

import { TaskCard } from "./task-card";

/**
 * One collapsible status section: a header carrying the status dot, label and
 * count badge, over the tasks in that status.
 *
 * Collapsed state is owned by the parent (it is persisted as a single map), so
 * this is a controlled Collapsible.
 */
export function TaskSection({
  status,
  label,
  tasks,
  categoriesById,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskDTO[];
  categoriesById: Map<string, CategoryDTO>;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (task: TaskDTO) => void;
  /** Resolves true when the task was deleted, which closes the confirm dialog. */
  onDelete: (task: TaskDTO) => Promise<boolean>;
}) {
  const accent = STATUS_ACCENT[status];

  return (
    <Collapsible open={!collapsed} onOpenChange={onToggle} className="mb-3.5">
      <CollapsibleTrigger className="focus-visible:ring-ring/50 focus-visible:border-ring flex w-full items-center gap-2.5 rounded-lg border border-transparent px-0.5 py-2 outline-none focus-visible:ring-3">
        <ChevronDown
          className={cn(
            "text-text-3 size-4 shrink-0 transition-transform duration-[180ms]",
            collapsed && "-rotate-90"
          )}
        />
        <span className={cn("size-2 shrink-0 rounded-full ring-3", accent.dot, accent.ring)} />
        <span className="text-[14.5px] font-semibold tracking-[-0.01em]">{label}</span>
        <span className="text-text-3 bg-surface-2 min-w-6 rounded-full border px-[9px] py-px text-center text-xs font-semibold">
          {tasks.length}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {tasks.length === 0 ? (
          <p className="text-text-faint px-1 pt-2.5 text-[13.5px]">
            No {label.toLowerCase()} tasks.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2.5">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                category={task.categoryId ? categoriesById.get(task.categoryId) : undefined}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
