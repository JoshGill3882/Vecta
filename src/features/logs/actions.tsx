"use server";

import { refresh } from "next/cache";

import { ageOutLogs } from "@/src/server/log-retention";
import { setLogRetention } from "@/src/server/services/settings";
import type { LogRetentionDays } from "@/src/shared/lib/dtos/settings";
import { ActionResult, toActionError } from "@/src/shared/lib/result";
import { logRetentionDaysSchema } from "@/src/shared/lib/schemas/settings";
import { getSession } from "@/src/shared/lib/session";
import { validate } from "@/src/shared/lib/validation";

// The Logs page reads nothing through the cache, so there is no tag to bust
// after a write: `refresh` re-renders the page the action was called from.

/** Server Action for choosing how long log entries are kept.
 *
 * The choice is used from the next run on; entries already older than it stay
 * until then, or until Remove now.
 *
 * @param days The days to keep entries for, or 0 for forever. Typed as unknown
 *   because a Server Action can be called with anything, whatever its caller's
 *   types say.
 * @returns ActionResult with the saved choice, or Error.
 */
export async function setLogRetentionAction(
  days: unknown
): Promise<ActionResult<LogRetentionDays>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  const result = validate(logRetentionDaysSchema, days);
  if (!result.success) return { ok: false, error: "Invalid input" };

  try {
    await setLogRetention(result.data);
    refresh();
    return { ok: true, data: result.data };
  } catch (e) {
    return toActionError(e);
  }
}

/** Server Action for ageing old entries out now, rather than waiting for the night.
 *
 * @returns ActionResult with how many entries were removed, or Error.
 */
export async function removeOldLogsAction(): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  try {
    const removed = await ageOutLogs();
    refresh();
    return { ok: true, data: removed };
  } catch (e) {
    return toActionError(e);
  }
}
