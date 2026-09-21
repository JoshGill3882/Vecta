"use client";

import { useSyncExternalStore } from "react";

/** A value kept in a cookie, and the way to change it. */
export interface PersistedValue<T> {
  /** The stored value, or the fallback where none is usable. */
  value: T;
  /** Replaces it, persists it, and notifies every reader in this tab. */
  set: (value: T) => void;
}

/** How long a preference outlives the visit that set it. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Reads one cookie by name.
 *
 * @param name The cookie name.
 * @returns Its decoded value, or undefined when it is not set.
 */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split("; ")) {
    const equals = part.indexOf("=");
    if (equals > 0 && part.slice(0, equals) == name) {
      return decodeURIComponent(part.slice(equals + 1));
    }
  }
  return undefined;
}

/** Builds a hook over one preference cookie, shared by every caller.
 *
 * A cookie because the server renders these preferences, and a cookie arrives
 * with the request, so the first paint is already correct. Storage the server
 * cannot reach - localStorage, IndexedDB - leaves the page painting a default
 * and then correcting itself once hydration finishes.
 *
 * The store is module scope, because a preference is one value however many
 * components read it, and reads come from an in-memory cache because
 * `useSyncExternalStore` compares snapshots by identity - parsing the cookie
 * afresh on every call would be an infinite render loop, not a slow render.
 *
 * @param name The cookie name.
 * @param parse Validates a parsed value. Anything it rejects falls back, which
 *    is what makes a stored value safe to trust: it survives deploys, so
 *    it can name something this version no longer has, and it is editable.
 * @param fallback Used before anything is stored, and whenever parsing fails.
 * @returns A hook returning the current value and a setter
 */
export function createPersistedValue<T>(
  name: string,
  parse: (raw: unknown) => T | undefined,
  fallback: T
): (initial?: T) => PersistedValue<T> {
  let cache: T = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();

  // Tells other tabs to re-read. A cookie fires no event of its own, and this
  // is absent in older browsers - where the preference still works, it simply
  // stops following a change made in a different tab.
  const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(name);

  /** Notifies every reader in this tab. */
  function emit() {
    for (const listener of listeners) listener();
  }

  /** Reads and validates the cookie.
   *
   * @returns The stored value, or the fallback where it is absent or unusable.
   */
  function read(): T {
    try {
      const raw = readCookie(name);
      if (raw === undefined) return fallback;
      return parse(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  /** The current value, reading the cookie once and caching it.
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

  /** Subscribes to changes, including those made in another tab.
   *
   * @param listener Called whenever the value changes.
   * @returns An unsubscribe function.
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    /** Re-reads when another tab writes the key. */
    function onMessage() {
      cache = read();
      loaded = true;
      emit();
    }

    channel?.addEventListener("message", onMessage);
    return () => {
      listeners.delete(listener);
      channel?.removeEventListener("message", onMessage);
    };
  }

  /** Writes a new value and tells every reader, here and in other tabs.
   *
   * @param next The value to store
   */
  function set(next: T) {
    cache = next;
    loaded = true;

    // Secure keyed to the actual protocol rather than the build mode: this is
    // self-hosted, and an install served over plain HTTP on a LAN would find a
    // Secure cookie silently never sent back
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const encoded = encodeURIComponent(JSON.stringify(next));
    document.cookie = `${name}=${encoded}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;

    emit();
    channel?.postMessage(null);
  }

  return function usePersistedValue(initial?: T): PersistedValue<T> {
    return { value: useSyncExternalStore(subscribe, getSnapshot, () => initial ?? fallback), set };
  };
}
