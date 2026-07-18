"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

// global-error replaces the root layout when active, so none of its markup or
// styles apply — this file must bring its own <html>/<body>, the `dark` class,
// the fonts, and the stylesheet that defines the design tokens.
import "./globals.css";
import { geistSans, geistMono } from "@/src/lib/fonts";

/**
 * Last-resort boundary. It catches errors that escape the route boundaries —
 * including failures in the root layout itself — that would otherwise blank the
 * whole app. Kept deliberately minimal and self-contained: it renders when even
 * the shell is broken, so it leans on plain elements and tokens rather than the
 * component library.
 *
 * Recovery uses `unstable_retry` (re-fetch + re-render), matching the route
 * boundary; `metadata` can't be exported here, so the tab title is set with a
 * plain <title>.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] global error", error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <title>Something went wrong · Task Manager</title>

        <div className="bg-surface-2 text-text-3 mb-4 flex size-14 items-center justify-center rounded-[14px] border">
          <TriangleAlert className="size-[26px]" />
        </div>
        <h1 className="text-[19px] font-semibold tracking-[-0.01em]">Something went wrong</h1>
        <p className="text-text-3 mt-2 max-w-[380px] text-sm">
          The app hit an unexpected error. This is usually temporary — try again in a moment.
        </p>

        <button
          type="button"
          onClick={() => unstable_retry()}
          className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring/50 focus-visible:border-ring mt-5 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium outline-none focus-visible:ring-3"
        >
          Try again
        </button>

        {error.digest && (
          <p className="text-text-faint mt-4 font-mono text-[11.5px]">Reference: {error.digest}</p>
        )}
      </body>
    </html>
  );
}
