import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";

/** Whether each status section is collapsed. */
export type CollapsedMap = Record<TaskStatus, boolean>;

/** The cookie collapsed state is stored under. */
export const SECTION_COLLAPSE_COOKIE = "vecta_collapsed";

/** Closed work is the lease interesting on arrival, so it starts folded away. */
export const SECTION_COLLAPSE_DEFAULTS: CollapsedMap = {
  open: false,
  in_progress: false,
  closed: true,
};

/** Validates a stored collapsed map.
 *
 * Each status is taken from the stored value only where it holds a boolean, so
 * a cookie edited by hand cannot propagate `undefined` into a section's open
 * state. The same function runs on the server and in the browser, so the two
 * cannot disagree about what a stored value means.
 *
 * @param raw The parsed cookie value.
 * @returns The map, or undefined when the value is not an object at all.
 */
export function parseCollapsed(raw: unknown): CollapsedMap | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const source = raw as Partial<Record<TaskStatus, unknown>>;
  return {
    open: typeof source.open === "boolean" ? source.open : SECTION_COLLAPSE_DEFAULTS.open,
    in_progress:
      typeof source.in_progress === "boolean"
        ? source.in_progress
        : SECTION_COLLAPSE_DEFAULTS.in_progress,
    closed: typeof source.closed === "boolean" ? source.closed : SECTION_COLLAPSE_DEFAULTS.closed,
  };
}
