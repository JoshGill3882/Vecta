import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/src/shared/components/ui/button";

/**
 * DOM id of the empty state's heading. A delete that empties the list leaves no
 * section header to return focus to, so this heading stands in as the landmark.
 */
export const tasksEmptyStateHeadingId = "tasks-empty-state-heading";

/** Copy for the no-results state.
 *
 * It names the controls actually narrowing the list, so the message cannot
 * blame a search when a filter is what emptied it, and the action says exactly
 * what it will clear.
 *
 * @param query The query as typed.
 * @param byCategory Whether any category is selected.
 * @returns The sentence to show, and the label for the control that clears it.
 */
export function describeNoMatches(query: string, byCategory: boolean) {
  const trimmed = query.trim();
  if (trimmed && byCategory) {
    return {
      detail: `Nothing matches “${trimmed}” in the selected categories.`,
      action: "Clear search and filters",
    };
  }
  if (trimmed) return { detail: `Nothing matches “${trimmed}”.`, action: "Clear search" };
  return { detail: "No tasks in the selected categories.", action: "Clear filters" };
}

/** The task list standing in for itself when it has nothing to show.
 *
 * Both reasons the list can be empty — no tasks at all, and nothing matching
 * what narrows it — render through here, so they cannot drift apart visually
 * and only one of them carries the focus landmark.
 */
export function TasksEmptyState({
  icon: Icon,
  heading,
  children,
  action,
}: {
  icon: LucideIcon;
  heading: string;
  children: ReactNode;
  /** Shown only when there is something for the reader to undo. */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-text-2 px-5 py-[60px] text-center">
      <div className="bg-surface-2 text-text-3 mx-auto mb-4 flex size-14 items-center justify-center rounded-[14px] border">
        <Icon className="size-[26px]" />
      </div>
      <h2 id={tasksEmptyStateHeadingId} tabIndex={-1} className="mb-1.5 text-[17px]">
        {heading}
      </h2>
      <p className="text-text-3 text-sm">{children}</p>
      {action && (
        <Button variant="outline" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
