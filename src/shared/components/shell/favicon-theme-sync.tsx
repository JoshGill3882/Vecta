"use client";

import { useEffect } from "react";

/**
 * Browsers rasterise a favicon once and cache the bitmap against its URL, so the
 * `prefers-color-scheme` query inside `app/icon.svg` is only evaluated when that
 * raster is produced. Switching theme leaves the stale icon in the tab until a
 * hard refresh; re-pointing the link at a fresh URL forces a new one.
 *
 * Progressive enhancement only - without JS the icon is still correct for whatever theme was active when the page loaded.
 */

export function FaviconThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function repaint() {
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel="icon"][type="image/svg+xml"]'
      );
      if (!link) return;

      // Next's href already carries a bare cache-busting key (`?icon.<hash>.svg`).
      // Appending as a string rather than via URLSearchParams, which would
      // re-serialise that valueless key as `icon.<hash>.svg=`.
      const base = link.href.split("&theme=")[0];

      // Replacing the element rather than mutating href: some browsers ignore an
      // in-place href change on an icon link.
      const next = link.cloneNode() as HTMLLinkElement;
      next.href = `${base}&theme=${media.matches ? "dark" : "light"}`;
      link.replaceWith(next);
    }

    media.addEventListener("change", repaint);
    return () => media.removeEventListener("change", repaint);
  }, []);

  return null;
}
