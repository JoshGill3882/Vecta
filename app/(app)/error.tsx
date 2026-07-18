"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/src/components/ui/button";

/**
 * Error boundary for the authenticated area. Sitting at the `(app)` segment, it
 * wraps both the tasks and categories routes but *not* `(app)/layout.tsx` above
 * it — so a thrown render or failed data read swaps only the main region for
 * this fallback while the top bar stays put and the user can still switch tabs.
 *
 * Recovery goes through `unstable_retry`, not `reset`: this Next re-fetches and
 * re-renders the segment on retry (`reset` only clears error state without
 * re-fetching, which would just re-throw a data-fetch failure). See
 * node_modules/next/dist/docs/.../file-conventions/error.md.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log the detail for the operator; the UI stays generic. In production the
    // error reaching the client is already scrubbed to a digest — nothing
    // sensitive to leak, and nothing useful to show a user either.
    console.error("[app] route error", error);
  }, [error]);

  return (
    <section className="text-text-2 px-5 py-[60px] text-center" aria-live="assertive">
      <div className="bg-surface-2 text-text-3 mx-auto mb-4 flex size-14 items-center justify-center rounded-[14px] border">
        <TriangleAlert className="size-[26px]" />
      </div>
      <h2 className="mb-1.5 text-[17px]">Something went wrong</h2>
      <p className="text-text-3 mx-auto max-w-[380px] text-sm">
        We couldn&apos;t load this page. This is usually temporary — try again in a moment.
      </p>

      <Button size="lg" onClick={() => unstable_retry()} className="mt-5">
        <RotateCw className="size-4" />
        Try again
      </Button>

      {error.digest && (
        // A non-sensitive handle the user can quote so the matching server log
        // can be found. Not an error message — just a correlation id.
        <p className="text-text-faint mt-4 font-mono text-[11.5px]">Reference: {error.digest}</p>
      )}
    </section>
  );
}
