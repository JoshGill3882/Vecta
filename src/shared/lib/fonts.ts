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
export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
