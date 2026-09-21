"use client";

import { useCallback } from "react";

import { createPersistedValue } from "@/src/shared/hooks/use-persisted-value";
import {
  parseCollapsed,
  SECTION_COLLAPSE_COOKIE,
  SECTION_COLLAPSE_DEFAULTS,
  type CollapsedMap,
} from "@/src/features/tasks/lib/section-collapse";
import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";

/** The stored map, shared by every component reading the collapse state. */
const usePersistedCollapsed = createPersistedValue(
  SECTION_COLLAPSE_COOKIE,
  parseCollapsed,
  SECTION_COLLAPSE_DEFAULTS
);

/** Open/closed state for the three status sections, persisted in a cookie.
 *
 * @param initial The state the server rendered with, so the first paint
 *    already matches the stored preference.
 * @returns The collapsed state of every status, and a setter taking the new
 *    value for one of them.
 */
export function useCollapsedSections(initial?: CollapsedMap) {
  const { value: collapsed, set } = usePersistedCollapsed(initial);

  // Takes the new value rather than flipping the old one. A flip assumes the
  // rendered state and the stored state agree, which is not true of a section
  // held open by something other than this preference.
  const setCollapsed = useCallback(
    (id: TaskStatus, next: boolean) => set({ ...collapsed, [id]: next }),
    [collapsed, set]
  );

  return { collapsed, setCollapsed };
}
