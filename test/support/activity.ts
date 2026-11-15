import { flushLogs } from "@/src/server/logger";
import { listLogs } from "@/src/server/services/logs";

/** One activity entry as the integration tests compare it. */
export interface ActivityEntry {
  /** Its event name, such as `task.deleted`. */
  event: string;
  /** Its context, as read back from the table. */
  detail: unknown;
}

/** The activity entries in the Log table, once every pending write has landed.
 *
 * Entries written in the same millisecond have no reliable order between them,
 * so they come back sorted by event name rather than as the log lists them.
 *
 * @returns Each activity entry's event and detail.
 */
export async function activityEntries(): Promise<ActivityEntry[]> {
  await flushLogs();
  const entries = await listLogs();
  return entries
    .filter((entry) => entry.kind === "activity")
    .map(({ event, detail }) => ({ event, detail }))
    .sort((a, b) => a.event.localeCompare(b.event));
}
