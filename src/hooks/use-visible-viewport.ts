"use client";

import { useEffect, useState } from "react";

/** The slice of the page actually on screen, in CSS pixels. */
export type VisibleViewport = { height: number; offsetTop: number };

/**
 * Tracks the visual viewport on touch devices — the part of the page left over
 * once the on-screen keyboard is up.
 *
 * `dvh` is not enough on its own. It follows the browser's own chrome (the URL
 * bar collapsing as you scroll), but the keyboard is not chrome: by default it
 * overlays the page without resizing the layout viewport, so `100dvh` still
 * measures the whole screen and the bottom of a full-height dialog sits behind
 * the keyboard, unreachable — scrolling its body doesn't help, because the
 * element's own bottom edge is off screen. `interactiveWidget: "resizes-content"`
 * in the root layout fixes that on Chrome/Android. iOS Safari ignores it, and
 * `window.visualViewport` is the only thing there that reports the keyboard.
 *
 * Returns `null` on a fine pointer or where the API is missing, which callers
 * should read as "change nothing" and leave the CSS in charge — the keyboard is
 * a touch problem, and a mouse user resizing a window is already handled.
 * `offsetTop` matters because iOS scrolls the visual viewport within the layout
 * viewport rather than resizing it, which shifts where a fixed element must sit
 * to look anchored.
 */
export function useVisibleViewport(): VisibleViewport | null {
  const [visible, setVisible] = useState<VisibleViewport | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia("(pointer: coarse)").matches) return;

    // Both events fire: `resize` when the keyboard opens or closes, `scroll`
    // when iOS pans the visual viewport to keep the focused field in view.
    const sync = () => setVisible({ height: vv.height, offsetTop: vv.offsetTop });
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return visible;
}
