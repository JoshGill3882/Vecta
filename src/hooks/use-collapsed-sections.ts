"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { TaskStatus } from "@/src/lib/dtos/tasks";

type CollapsedMap = Record<TaskStatus, boolean>;

const STORAGE_KEY = "jl_collapsed";

/** Closed work is the least interesting on arrival, so it starts folded away. */
const DEFAULTS: CollapsedMap = { open: false, in_progress: false, closed: true };

/**
 * localStorage is user-editable and survives across deploys, so a stored value
 * is untrusted input: anything that isn't a boolean for a known status falls
 * back to the default rather than propagating `undefined` into `open`.
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

/*
 * The collapsed map is a single global preference, so the store lives at module
 * scope rather than per-hook-instance.
 *
 * `cache` — not localStorage — is the read source of truth: useSyncExternalStore
 * requires getSnapshot to return a stable reference (a fresh object each call is
 * an infinite render loop), and keeping the value in memory also means the UI
 * still works when storage is blocked and the write below silently fails.
 */
let cache: CollapsedMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot(): CollapsedMap {
  cache ??= readStored();
  return cache;
}

/**
 * The server has no localStorage, so it always renders the defaults. React uses
 * this snapshot for SSR *and* for the hydration render, then re-renders with the
 * client snapshot — which is what keeps a user whose stored state differs from
 * DEFAULTS from tripping a hydration mismatch. The cost is a one-frame flash for
 * those users; avoiding it entirely would need a blocking inline script, which
 * is a steep price for a section that starts folded.
 */
function getServerSnapshot(): CollapsedMap {
  return DEFAULTS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Keeps two tabs of the app in agreement. `storage` only fires in *other*
  // documents, so same-tab updates rely on the explicit emit() in toggle().
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

/** Open/closed state for the three status sections, persisted to localStorage. */
export function useCollapsedSections() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: TaskStatus) => {
    const next = { ...getSnapshot(), [id]: !getSnapshot()[id] };
    cache = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked or over quota — persistence is a nicety, not a feature
      // worth breaking the page over. The in-memory cache still drives the UI.
    }
    emit();
  }, []);

  return { collapsed, toggle };
}
