"use client";

import { useSyncExternalStore } from "react";

/** Matches a primary pointer that is a finger rather than a mouse or pen. */
const COARSE_POINTER = "(pointer: coarse)";

/** Follows changes to the pointer type, such as a tablet docking a keyboard.
 *
 * @param onChange Called whenever the media query's answer changes.
 * @returns A function that stops following.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Reads whether the primary pointer is coarse right now.
 *
 * @returns True on a touch screen.
 */
function getSnapshot(): boolean {
  return window.matchMedia(COARSE_POINTER).matches;
}

/** The answer while rendering on the server, which has no pointer to ask about.
 *
 * @returns False, so the server renders the mouse version.
 */
function getServerSnapshot(): boolean {
  return false;
}

/** Whether the reader is pointing with a finger, kept current as that changes.
 *
 * Chooses between versions of a control built for different pointers. Styling
 * alone should use the `pointer-coarse:` variant instead; this is for when the
 * markup itself differs.
 *
 * @returns True when the primary pointer is coarse.
 */
export function usePointerCoarse(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
