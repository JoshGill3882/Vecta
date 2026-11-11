import type { MetadataRoute } from "next";

import { APP_DESCRIPTION, APP_NAME } from "@/src/shared/lib/app-identity";

/** The app's background, `--background` in the dark block of `app/globals.css`.
 *
 * Both manifest colours use it: the theme colour tints the status bar above
 * the installed app, and the background colour fills the splash screen while
 * it loads, so either one differing would show as a seam against the page. It
 * is the flat token rather than the body's gradient, which a manifest colour
 * cannot express.
 */
const BACKGROUND = "#0a0c10";

/** The web app manifest, which is what makes the app installable to a home screen.
 *
 * Served as a public, cacheable file, so it holds static copy only: no host,
 * URL or anything else that belongs to one instance. Reading a request-time
 * API here would make Next render it on every request for no gain.
 *
 * There is deliberately no service worker alongside it. Installing no longer
 * needs one, and working offline would be a feature of its own.
 *
 * @returns The manifest, which Next serves at `/manifest.webmanifest`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    // "/" rather than the task list's own path, so the redirect in
    // next.config.ts stays the one place that decides where home is.
    start_url: "/",
    // Its own window, without the browser's address bar. "browser" would
    // disqualify the app from installing at all.
    display: "standalone",
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    // Built by `npm run icons:generate`. The maskable pair is opaque and keeps
    // the mark inside the circle every launcher's mask leaves; the plain pair
    // is the bare mark, for surfaces that show an icon without masking it.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
