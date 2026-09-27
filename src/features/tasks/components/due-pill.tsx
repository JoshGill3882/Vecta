import { Calendar, Clock } from "lucide-react";

import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import { cn } from "@/src/shared/lib/utils";
import { dueMeta, type DueMeta } from "@/src/features/tasks/lib/due-date";

/** Pill colours per due state. All quiet: the loud states - overdue, and due
 * today - belong to the overdue indicator, which adds them to this map. */
const DUE_STYLES: Record<DueMeta["state"], string> = {
  soon: "text-text-2 border-border bg-surface-2",
  future: "text-text-3 border-border",
  past: "text-text-3 border-border",
};

/** A task's due date as a pill, or nothing at all when it has none. */
export function DuePill({ task, now }: { task: Pick<TaskDTO, "dueAt">; now: Date }) {
  const meta = dueMeta(task, now);
  if (!meta) return null;

  const Icon = meta.icon === "clock" ? Clock : Calendar;

  return (
    <span
      title={meta.full}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border py-[5px] pr-[11px] pl-2 text-[12.5px] leading-none font-medium whitespace-nowrap",
        DUE_STYLES[meta.state]
      )}
    >
      <Icon className="size-[12.5px] shrink-0" aria-hidden />
      {/* The label depends on "today", which the server (the container's clock
          and timezone) and the browser can disagree about - the same case as the
          card's relative timestamp, so the same one warning is suppressed. */}
      <span suppressHydrationWarning>{meta.label}</span>
      {/* aria-label is ignored on a plain span, so the full date is given to
          screen readers as hidden text; `title` covers the mouse. */}
      <span className="sr-only">, {meta.full}</span>
    </span>
  );
}
