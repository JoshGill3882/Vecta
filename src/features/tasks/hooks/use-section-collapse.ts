"use client";

import { useState } from "react";

import { useCollapsedSections } from "@/src/features/tasks/hooks/use-collapsed-sections";
import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";

/** Whether each status section is collapsed, and how to change it. */
export interface SectionCollapse {
  /** Whether the section for this status is currently collapsed. */
  isCollapsed: (status: TaskStatus) => boolean;
  /** Collapses or expands the section for this status. */
  setCollapsed: (status: TaskStatus, collapsed: boolean) => void;
}

/** Owns whether each status section is collapsed, across both states it has.
 *
 * A section collapsed while browsing is a preference and persists. A section
 * collapsed while the list is narrowed is a transient act on a transient view,
 * so it is held in memory and discarded when the narrowing ends — otherwise a
 * momentary tidy-up during a search would silently rewrite a preference set for
 * an unrelated reason.
 *
 * While narrowing, sections start expanded whatever the preference says,
 * because a match hidden inside a collapsed section reads as no match.
 *
 * Callers see one pair of functions and never the seam between the two states.
 *
 * @param narrowed Whether anything is currently narrowing the list.
 * @returns A reader and a setter covering whichever state applies.
 */
export function useSectionCollapse(narrowed: boolean): SectionCollapse {
  const { collapsed, setCollapsed } = useCollapsedSections();
  const [transient, setTransient] = useState<Partial<Record<TaskStatus, boolean>>>({});

  // Discarded when narrowing ends, whichever control ended it. Adjusted during
  // render rather than after it: React applies this before the sections render,
  // so they never see a map left over from the last time the list was narrowed.
  const [wasNarrowed, setWasNarrowed] = useState(narrowed);
  if (wasNarrowed !== narrowed) {
    setWasNarrowed(narrowed);
    if (!narrowed) setTransient({});
  }

  return {
    isCollapsed: (status) => (narrowed ? (transient[status] ?? false) : collapsed[status]),
    setCollapsed: (status, next) =>
      narrowed
        ? setTransient((previous) => ({ ...previous, [status]: next }))
        : setCollapsed(status, next),
  };
}
