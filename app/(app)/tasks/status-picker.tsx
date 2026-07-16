"use client";

import type { TaskStatus } from "@/src/lib/dtos/tasks";
import { STATUS_ACCENT, TASK_STATUSES } from "@/src/lib/task-status";
import { cn } from "@/src/lib/utils";

/**
 * The segmented status control from the design: three equal-width buttons, the
 * selected one tinted in its own status colour. The leading dot always carries
 * the status colour, selected or not — it's what makes the three readable at a
 * glance rather than only the active one.
 *
 * `STATUS_ACCENT.badge` already bundles the text/border/background trio the
 * selected state needs, so it's reused here rather than restated.
 */
export function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Status" className="flex gap-1.5">
      {TASK_STATUSES.map((status) => {
        const accent = STATUS_ACCENT[status.id];
        const selected = value === status.id;

        return (
          <button
            key={status.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(status.id)}
            className={cn(
              "focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[9px] border text-[13.5px] font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50",
              selected ? accent.badge : "text-text-3 border-border bg-transparent"
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} />
            {status.label}
          </button>
        );
      })}
    </div>
  );
}
