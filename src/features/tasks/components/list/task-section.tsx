"use client";

import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/shared/components/ui/collapsible";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskDTO, TaskStatus } from "@/src/shared/lib/dtos/tasks";
import { STATUS_ACCENT } from "@/src/shared/lib/task-status";
import { cn } from "@/src/shared/lib/utils";

import { TaskCard } from "./task-card";

/**
 * DOM id of a section's header button. It's the focus landmark a successful
 * delete lands on: the card that opened the confirm dialog is gone by then, so
 * focus returns to the header of the status it lived under rather than to
 * `<body>`.
 *
 * @param status The status whose section header is wanted.
 * @returns The DOM id of that section's header.
 */
export function taskSectionHeaderId(status: TaskStatus) {
  return `task-section-${status}`;
}

/**
 * Layout of a section header row. Shared by both forms the header takes so the
 * dot, label and count stay in one column down the list.
 */
const HEADER_ROW =
  "focus-visible:ring-ring/50 focus-visible:border-ring flex w-full items-center gap-2.5 rounded-lg border border-transparent px-0.5 py-2 outline-none focus-visible:ring-3";

/** Everything a section header shows apart from the chevron. */
function SectionHeading({
  status,
  label,
  count,
}: {
  status: TaskStatus;
  label: string;
  count: number;
}) {
  const accent = STATUS_ACCENT[status];

  return (
    <>
      <span className={cn("size-2 shrink-0 rounded-full ring-3", accent.dot, accent.ring)} />
      <span className="text-[14.5px] font-semibold tracking-[-0.01em]">{label}</span>
      <span className="text-text-3 bg-surface-2 min-w-6 rounded-full border px-[9px] py-px text-center text-xs font-semibold">
        {count}
      </span>
    </>
  );
}

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
  onCollapsedChange,
  onEdit,
  onDelete,
  needle,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskDTO[];
  categoriesById: Map<string, CategoryDTO>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onEdit: (task: TaskDTO) => void;
  /** Resolves true when the task was deleted, which closes the confirm dialog. */
  onDelete: (task: TaskDTO) => Promise<boolean>;
  needle: string;
}) {
  // A section with nothing in it has nothing to collapse, so it does not offer the control:
  // heading only, no chevron and no body. The stored collapsed state is neither read here
  // nor written, so a section that empties and later refills comes back the way the user
  // left it
  if (tasks.length === 0) {
    return (
      <h2 id={taskSectionHeaderId(status)} tabIndex={-1} className={cn(HEADER_ROW, "mb-3.5")}>
        {/* Holds the chevron's column, so an empty section dot stays in line with the populated
            sections above and below it */}
        <span className="size-4 shrink-0" />
        <SectionHeading status={status} label={label} count={0} />
      </h2>
    );
  }

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(open) => onCollapsedChange(!open)}
      className="mb-3.5"
    >
      {/* A real <h2> so the list reads h1 (page) -> h2 (status section) -> h3 (card title): the 
          section header carries the visuals, but the heading is what gives screen readers and
          Lighthouse a proper outline. Preflight leaves headings unstyled, so the wrapper adds no
          layout of its own. */}
      <h2>
        <CollapsibleTrigger id={taskSectionHeaderId(status)} className={HEADER_ROW}>
          <ChevronDown
            className={cn(
              "text-text-3 size-4 shrink-0 transition-transform duration-[180ms]",
              collapsed && "-rotate-90"
            )}
          />
          <SectionHeading status={status} label={label} count={tasks.length} />
        </CollapsibleTrigger>
      </h2>

      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-2.5">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              category={task.categoryId ? categoriesById.get(task.categoryId) : undefined}
              onEdit={onEdit}
              onDelete={onDelete}
              needle={needle}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
