"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";

/** Whether each status section is collapsed. */
type CollapsedMap = Record<TaskStatus, boolean>;

/** localStorage key the preference is written under. */
const STORAGE_KEY = "jl_collapsed";

/** Closed work is the least interesting on arrival, so it starts folded away. */
const DEFAULTS: CollapsedMap = { open: false, in_progress: false, closed: true };

/** Reads the stored preference, treating it as untrusted input.
 *
 * localStorage is user-editable and survives across deploys, so anything that
 * is not a boolean for a known status falls back to the default rather than
 * propagating `undefined` into `open`.
 *
 * @returns The stored map, or the defaults where a value is missing or unusable.
 */
function readStored(): CollapsedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;

    const source = parsed as Partial<Record<TaskStatus, unknown>>;
    return {
      open: typeof source.open === "boolean" ? source.open : DEFAULTS.open,
      in_progress:
        typeof source.in_progress === "boolean" ? source.in_progress : DEFAULTS.in_progress,
      closed: typeof source.closed === "boolean" ? source.closed : DEFAULTS.closed,
    };
  } catch {
    // Malformed JSON, or a browser with storage disabled/blocked.
    return DEFAULTS;
  }
}

/** The read source of truth, rather than localStorage itself.
 *
 * The collapsed map is one global preference, so the store lives at module
 * scope rather than per hook instance. `useSyncExternalStore` needs
 * `getSnapshot` to return a stable reference — a fresh object each call is an
 * infinite render loop — and holding the value in memory also keeps the UI
 * working when storage is blocked and the write silently fails.
 */
let cache: CollapsedMap | null = null;

/** Subscribers to notify when the preference changes. */
const listeners = new Set<() => void>();

/** Notifies every subscriber that the preference changed. */
function emit() {
  for (const listener of listeners) listener();
}

/** The current preference, reading storage once and caching it.
 *
 * @returns A stable reference, which `useSyncExternalStore` requires.
 */
function getSnapshot(): CollapsedMap {
  cache ??= readStored();
  return cache;
}

/** The preference as the server sees it, which is always the defaults.
 *
 * React uses this for the server render and the hydration render both, then
 * re-renders from the client snapshot. That is what keeps a user whose stored
 * state differs from the defaults from tripping a hydration mismatch. The cost
 * is a one-frame flash for those users; avoiding it would need a blocking
 * inline script, which is steep for a section that starts folded.
 *
 * @returns The defaults.
 */
function getServerSnapshot(): CollapsedMap {
  return DEFAULTS;
}

/** Subscribes to preference changes, including those from another tab.
 *
 * @param listener Called whenever the preference changes.
 * @returns An unsubscribe function.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  /** Re-reads the preference when another tab changes it.
   *
   * `storage` only fires in other documents, so a change made in this tab
   * relies on the explicit notify in the setter instead.
   *
   * @param event The storage event, which names the key that changed.
   */
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = readStored();
    emit();
  }

  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Open/closed state for the three status sections, persisted to localStorage.
 *
 * @returns The collapsed state of every status, and a setter taking the new
 *   value for one of them.
 */
export function useCollapsedSections() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Takes the new value rather than flipping the old one. A flip assumes the
  // rendered state and the stored state agree, which is not true of a section
  // held open by something other than this preference.
  const setCollapsed = useCallback((id: TaskStatus, collapsed: boolean) => {
    const next = { ...getSnapshot(), [id]: collapsed };
    cache = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked or over quota — persistence is a nicety, not a feature
      // worth breaking the page over. The in-memory cache still drives the UI.
    }
    emit();
  }, []);

  return { collapsed, setCollapsed };
}
