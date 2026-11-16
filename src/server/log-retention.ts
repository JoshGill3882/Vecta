import "server-only";

import { logger } from "@/src/server/logger";
import { countLogsBefore, deleteLogsBefore } from "@/src/server/services/logs";
import { getSettings, recordAgeOut } from "@/src/server/services/settings";
import type { LogRetentionDays, RetentionStatusDTO } from "@/src/shared/lib/dtos/settings";

// Log retention - ages old entries out of the log, keeping it to the length
// chosen on the Logs page. A run records what it did in the settings, never in
// the log itself, so retention never adds to the log it trims.
//
// Runs happen on a timer inside the server, once at start-up and then every
// night, so no external scheduler is needed. A failed run is logged and left
// for the next night; it never stops the timer or reaches a request.

/** The hour, on the server's clock, at which old entries are aged out each night. */
const AGE_OUT_HOUR = 3;

/** The timer for the next nightly run, once one is set.
 *
 * Kept on `globalThis` rather than in this module, because dev reloads modules
 * on every edit, and a reloaded module would otherwise set a second timer
 * beside the first.
 */
const globalForRetention = globalThis as unknown as { ageOutTimer?: NodeJS.Timeout };

/** Works out the moment before which an entry is older than the retention.
 *
 * Counted back in days of the calendar rather than spans of 24 hours, so the
 * cut-off keeps its time of day when the clocks have changed in between.
 *
 * @param days How many days entries are kept for, or 0 for forever.
 * @param now The moment to count back from.
 * @returns The cut-off, or null when entries are kept forever.
 */
export function retentionCutoff(days: LogRetentionDays, now: Date): Date | null {
  if (days === 0) return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/** Deletes the entries older than the chosen retention, and records the run.
 *
 * With forever chosen nothing is deleted, but the run is still recorded, so
 * the Logs page can show that it ran. Errors are not caught here: the nightly
 * timer and Remove now each decide what a failure means for them.
 *
 * @param now When the run happens, the moment the cut-off is counted back from.
 * @returns How many entries were removed.
 */
export async function ageOutLogs(now: Date = new Date()): Promise<number> {
  const { logRetentionDays } = await getSettings();
  const cutoff = retentionCutoff(logRetentionDays, now);
  const removed = cutoff === null ? 0 : await deleteLogsBefore(cutoff);
  await recordAgeOut(now, removed);
  return removed;
}

/** Reads what the Logs page shows about retention.
 *
 * The count is of what a run would remove if it happened now, which is what
 * Remove now removes; the nightly run counts back from its own moment, so it
 * may take a few more.
 *
 * @param now The moment the cut-off is counted back from.
 * @returns The chosen retention and last run, with the cut-off and how many entries are older than it.
 */
export async function getRetentionStatus(now: Date = new Date()): Promise<RetentionStatusDTO> {
  const settings = await getSettings();
  const cutoff = retentionCutoff(settings.logRetentionDays, now);
  const dueForRemoval = cutoff === null ? 0 : await countLogsBefore(cutoff);
  return { ...settings, cutoff: cutoff?.toISOString() ?? null, dueForRemoval };
}

/** Works out when the next nightly run is due.
 *
 * @param after The moment to look on from. A run due exactly then counts as past.
 * @returns The next `AGE_OUT_HOUR` o'clock after it, on the server's clock.
 */
export function nextAgeOutAt(after: Date): Date {
  const next = new Date(after.getFullYear(), after.getMonth(), after.getDate(), AGE_OUT_HOUR);
  if (next <= after) next.setDate(next.getDate() + 1);
  return next;
}

/** Ages old entries out, logging a failure rather than throwing it.
 *
 * @returns A promise that settles once the run has, whether or not it worked.
 */
async function runAgeOut(): Promise<void> {
  try {
    await ageOutLogs();
  } catch (error) {
    logger.error("log.age_out_failed", "Could not age old entries out of the log", { error });
  }
}

/** Sets the timer for the next nightly run, which sets the one after when it is done.
 *
 * Counting on from the run just due as well as from now means a timer that
 * fires a moment early still waits for the next night, rather than running
 * twice.
 *
 * @param after The run just due, or the moment the timer starts.
 */
function scheduleAgeOut(after: Date): void {
  const at = nextAgeOutAt(new Date(Math.max(Date.now(), after.getTime())));
  const timer = setTimeout(() => {
    void runAgeOut().finally(() => {
      // Stopped while the run was going: no more runs.
      if (globalForRetention.ageOutTimer === timer) scheduleAgeOut(at);
    });
  }, at.getTime() - Date.now());
  // The timer alone must not keep the process running once everything else has stopped.
  timer.unref();
  globalForRetention.ageOutTimer = timer;
}

/** Ages old entries out now, and every night from then on.
 *
 * The first run catches up on any night the server was down for. It is not
 * waited for, so start-up carries on while it runs. Calling this again once
 * the timer is set does nothing.
 */
export function startAgeOutSchedule(): void {
  if (globalForRetention.ageOutTimer !== undefined) return;
  void runAgeOut();
  scheduleAgeOut(new Date());
}

/** Stops the nightly runs, so a later `startAgeOutSchedule` starts them afresh.
 *
 * Nothing in the app calls this. It is for tests, and for anything that wants
 * the server to stop cleanly.
 */
export function stopAgeOutSchedule(): void {
  clearTimeout(globalForRetention.ageOutTimer);
  globalForRetention.ageOutTimer = undefined;
}
