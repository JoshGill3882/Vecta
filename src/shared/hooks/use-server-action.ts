"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ActionResult } from "@/src/shared/lib/result";

/** What a caller wants done with an action's outcome. */
export interface RunOptions<T> {
  /** Message shown once the action reports success. */
  success: string;
  /**
   * Runs after the success toast and before the route refreshes, for a caller
   * with something to record about the outcome. The delete flows use it to note
   * where focus should land, which has to happen before the list re-renders
   * without the row that had it.
   */
  beforeRefresh?: (data: T) => void;
}

/** Runs Server Actions, reporting the outcome and refreshing the route.
 *
 * Every call to an action repeats the same four steps: await it, show the error
 * and stop if it failed, show the success, refresh. Repeating them per call site
 * is how one of them ends up missing a refresh, or reporting success on a
 * failure.
 *
 * Only for actions called as promises. A form driven by `useActionState` gets
 * its result as state rather than a return value, so it reports its own outcome.
 *
 * @returns A function that runs one action, resolving to its data, or to `null`
 *   when the action failed and the error has been reported.
 */
export function useServerAction() {
  const router = useRouter();

  return useCallback(
    /** Runs one action and reports its outcome.
     *
     * @param action The pending action call.
     * @param options What to report, and what to do before refreshing.
     * @returns The action's data, or `null` if it failed.
     */
    async function run<T>(action: Promise<ActionResult<T>>, options: RunOptions<T>) {
      const result = await action;

      if (!result.ok) {
        toast.error(result.error);
        return null;
      }

      toast.success(options.success);
      options.beforeRefresh?.(result.data);
      router.refresh();
      return result.data;
    },
    [router]
  );
}
