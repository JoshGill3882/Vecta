import type { TaskStatus } from "@/src/lib/dtos/tasks";
import { STATUS_ACCENT, TASK_STATUSES } from "@/src/lib/task-status";
import { cn } from "@/src/lib/utils";

/**
 * A task's status as a tinted pill with a leading dot — the "badge" status
 * treatment from the design. Sits in `src/components` rather than beside the
 * route because the task dialog shows the same badge.
 */
export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const label = TASK_STATUSES.find((s) => s.id === status)?.label ?? status;
  const accent = STATUS_ACCENT[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full border py-[5px] pr-[11px] pl-[9px] text-[12.5px] leading-none font-medium whitespace-nowrap",
        accent.badge,
        className
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} />
      {label}
    </span>
  );
}
