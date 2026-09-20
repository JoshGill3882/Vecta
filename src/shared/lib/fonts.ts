import { Geist, Geist_Mono } from "next/font/google";

/**
 * App fonts, defined once and shared. The root layout applies these to `<html>`
 * so `--font-geist-sans` / `--font-geist-mono` (which globals.css maps to
 * `font-sans` / `font-mono`) are defined for the whole tree.
 *
 * `global-error.tsx` replaces the root layout entirely, so it can't inherit
 * those variables — it imports these same instances and re-applies them, which
 * is why they live here rather than inline in the layout.
 */

/** The body face, exposed as `--font-geist-sans`. */
export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** The monospace face, exposed as `--font-geist-mono`. */
export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
