"use client";

import { useTransition } from "react";

import { removeOldLogsAction } from "@/src/features/logs/actions";
import { Button } from "@/src/shared/components/ui/button";
import { useServerAction } from "@/src/shared/hooks/use-server-action";

/** Removes the entries older than the retention straight away, rather than at night.
 *
 * Disabled while it runs, so a second press cannot start a second run.
 */
export function RemoveNowButton() {
  const runAction = useServerAction();
  const [pending, startTransition] = useTransition();

  /** Runs the removal and reports how it went. */
  function removeNow() {
    startTransition(async () => {
      await runAction(removeOldLogsAction(), { success: "Old log entries removed" });
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={removeNow}>
      {pending ? "Removing…" : "Remove now"}
    </Button>
  );
}
