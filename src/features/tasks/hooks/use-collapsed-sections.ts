"use client";

import { useCallback } from "react";

import { createPersistedValue } from "@/src/shared/hooks/use-persisted-value";
import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";

/** Whether each status section is collapsed. */
type CollapsedMap = Record<TaskStatus, boolean>;

/** Closed work is the least interesting on arrival, so it starts folded away. */
const DEFAULTS: CollapsedMap = { open: false, in_progress: false, closed: true };

/** Validates a stored collapsed map.
 *
 * Each status is taken from storage only where it holds a boolean, so a value
 * edited by hand cannot propagate `undefined` into a section's open state.
 *
 * @param raw The parsed value from storage.
 * @returns The map, or undefined when the storage value is not an object.
 */
function parseCollapsed(raw: unknown): CollapsedMap | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const source = raw as Partial<Record<TaskStatus, unknown>>;
  return {
    open: typeof source.open === "boolean" ? source.open : DEFAULTS.open,
    in_progress:
      typeof source.in_progress === "boolean" ? source.in_progress : DEFAULTS.in_progress,
    closed: typeof source.closed === "boolean" ? source.closed : DEFAULTS.closed,
  };
}

/** The stored map, shared by every component reading the collapse state. */
const usePersistedCollapsed = createPersistedValue("vecta_collapsed", parseCollapsed, DEFAULTS);

/** Open/closed state for the three status sections, persisted to localStorage.
 *
 * @returns The collapsed state of every status, and a setter taking the new
 *    value for one of them.
 */
export function useCollapsedSections() {
  const { value: collapsed, set } = usePersistedCollapsed();

  // Takes the new value rather than flipping the old one. A flip assumes the
  // rendered state and the stored state agree, which is not true of a section
  // held open by something other than this preference.
  const setCollapsed = useCallback(
    (id: TaskStatus, next: boolean) => set({ ...collapsed, [id]: next }),
    [collapsed, set]
  );

  return { collapsed, setCollapsed };
}
