import "server-only";

import { deleteLogsBefore } from "@/src/server/services/logs";
import { getSettings, recordAgeOut } from "@/src/server/services/settings";
import type { LogRetentionDays } from "@/src/shared/lib/dtos/settings";

// Log retention - ages old entries out of the log, keeping it to the length
// chosen on the Logs page. A run records what it did in the settings, never in
// the log itself, so retention never adds to the log it trims.

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
