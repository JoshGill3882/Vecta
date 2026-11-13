import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";

/** The three status sections, in the order the list view renders them.
 *
 * The DTO's `TaskStatus` union is the source of truth for the ids; this adds
 * the display labels and fixes an order, neither of which belongs in the DTO.
 */
export const TASK_STATUSES: readonly { id: TaskStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "closed", label: "Closed" },
];

/** Per-status Tailwind classes, written out in full.
 *
 * Not composed from a colour name: Tailwind only emits classes it can read
 * literally in the source, so `text-status-${id}` would compile to nothing.
 */
export const STATUS_ACCENT: Record<TaskStatus, { dot: string; badge: string }> = {
  open: {
    dot: "bg-status-open",
    badge: "text-status-open border-status-open/30 bg-status-open/15",
  },
  in_progress: {
    dot: "bg-status-prog",
    badge: "text-status-prog border-status-prog/35 bg-status-prog/15",
  },
  closed: {
    dot: "bg-status-closed",
    badge: "text-status-closed border-status-closed/25 bg-status-closed/10",
  },
};
