import { Calendar, Clock, TriangleAlert } from "lucide-react";

import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import { cn } from "@/src/shared/lib/utils";
import { dueMeta, type DueMeta } from "@/src/features/tasks/lib/due-date";

/** Pill colours per due state, each measured to clear WCAG AA against the card.
 * Overdue reads as a problem and due today lighter, the one state still
 * actionable before it becomes one; everything else stays quiet. The overdue
 * tint is kept at 10%, where its text holds 4.5:1 - it falls below at 15%. */
const DUE_STYLES: Record<DueMeta["state"], string> = {
  overdue: "text-destructive border-destructive/40 bg-destructive/10 font-semibold",
  today: "text-brand-orange border-brand-orange/35 bg-brand-orange/15",
  soon: "text-text-2 border-border bg-surface-2",
  future: "text-text-3 border-border",
  done: "text-text-2 border-border",
};

/** The icon for each kind of due date. */
const DUE_ICONS = { alert: TriangleAlert, clock: Clock, calendar: Calendar };

/** A task's due date as a pill, or nothing at all when it has none. */
export function DuePill({ task, now }: { task: Pick<TaskDTO, "dueAt" | "status">; now: Date }) {
  const meta = dueMeta(task, now);
  if (!meta) return null;

  const Icon = DUE_ICONS[meta.icon];

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
