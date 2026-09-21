"use client";

import { useSyncExternalStore } from "react";

/** A value kept in localStorage, and the way to change it. */
export interface PersistedValue<T> {
  /** The stored value, or the fallback where none is usable. */
  value: T;
  /** Replaces it, persists it, and notifies every reader in this tab. */
  set: (value: T) => void;
}

/** Builds a hook over one localStorage key, shared by every caller.
 *
 * The store lives at module scope rather than per hook instance, because a
 * preference is one value however many components read it. `useSyncExternalStore`
 * needs `getSnapshot` to return a stable reference - a fresh object each call is
 * an infinite loop - so reads come from an in-memory cache, which also
 * keeps the UI working when storage is blocked and the write silently fails.
 *
 * @param key the localStorage key.
 * @param parse Validates a parsed value. Anything it rejects falls back, which
 *    is what makes a stored value safe to trust: it survives deploys, so it can
 *    name something this version no longer has, and it is editable by hand.
 * @param fallback Used before anything is stored, and whenever parsing fails.
 * @returns A hook returning the current value and a setter
 */
export function createPersistedValue<T>(
  key: string,
  parse: (raw: unknown) => T | undefined,
  fallback: T
): () => PersistedValue<T> {
  let cache: T = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();

  /** Notifies every reader in this tab. */
  function emit() {
    for (const listener of listeners) listener();
  }

  /** Reads and validates the stored value.
   *
   * @returns The stored value, or the fallback where it is absent or unusable.
   */
  function read(): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return parse(JSON.parse(raw)) ?? fallback;
    } catch {
      // Malformed JSON, or a browser with storage disabled or blocked.
      return fallback;
    }
  }

  /** The current value, reading storage once and caching it.
   *
   * @returns A stable reference, which `useSyncExternalStore` requires.
   */
  function getSnapshot(): T {
    if (!loaded) {
      cache = read();
      loaded = true;
    }
    return cache;
  }

  /** The value as the server sees it, which is always the fallback.
   *
   * React uses this for the server render and the hydration render both, then
   * re-renders from the client snapshot. That is what keeps a stored value
   * differing from the fallback from tripping a hydration mismatch.
   *
   * @returns The fallback.
   */
  function getServerSnapshot(): T {
    return fallback;
  }

  /** Subscribes to changes, including those made in another tab.
   *
   * @param listener Called whenever the value changes.
   * @returns An unsubscribe function.
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    /** Re-reads when another tab writes the key.
     *
     * `storage` fires only in other documents, so a change made here relies on
     * the explicit notify in `set` instead.
     *
     * @param event The storage event, which names the key that changed.
     */
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== key) return;
      cache = read();
      loaded = true;
      emit();
    }

    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  /** Writes a new value and tells every reader.
   *
   * @param next The value to store
   */
  function set(next: T) {
    cache = next;
    loaded = true;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage blocked or over quota. Persistence is a nicety, not a feature
      // worth breaking the page over; the in-memory cache still drives the UI.
    }
    emit();
  }

  return function usePersistedValue(): PersistedValue<T> {
    return { value: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), set };
  };
}
