import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/src/shared/components/ui/button";

/** DOM id of the empty state's heading.
 *
 * A delete that empties the list leaves no section header to return focus to,
 * so this heading stands in as the landmark.
 */
export const tasksEmptyStateHeadingId = "tasks-empty-state-heading";

/** Which filters are narrowing the list, beside any search. */
export interface NoMatchFilters {
  /** Any due-date option is selected. */
  byDue: boolean;
  /** Any category is selected. */
  byCategory: boolean;
}

/** Names the filters in force, in the toolbar's order.
 *
 * @param filters Which filters are in force.
 * @returns A phrase such as "the selected due dates and categories", or null
 *   when no filter is in force.
 */
function selectedFilters(filters: NoMatchFilters): string | null {
  const names: string[] = [];
  if (filters.byDue) names.push("due dates");
  if (filters.byCategory) names.push("categories");
  return names.length > 0 ? `the selected ${names.join(" and ")}` : null;
}

/** Copy for the no-results state.
 *
 * It names the controls actually narrowing the list, so the message cannot
 * blame a search when a filter is what emptied it, or one filter for what
 * another did, and the action says exactly what it will clear.
 *
 * @param query The query as typed.
 * @param filters Which filters are in force.
 * @returns The sentence to show, and the label for the control that clears it.
 */
export function describeNoMatches(query: string, filters: NoMatchFilters) {
  const trimmed = query.trim();
  const selected = selectedFilters(filters);
  if (trimmed && selected) {
    return {
      detail: `Nothing matches “${trimmed}” in ${selected}.`,
      action: "Clear search and filters",
    };
  }
  if (trimmed) return { detail: `Nothing matches “${trimmed}”.`, action: "Clear search" };
  // Something must be narrowing for the list to be empty with tasks in it, so
  // the fallback is never shown; it keeps the sentence whole if it ever is.
  return { detail: `No tasks in ${selected ?? "the selected filters"}.`, action: "Clear filters" };
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
