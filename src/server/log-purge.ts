import "server-only";

import { flushLogs, logger } from "@/src/server/logger";
import { deleteLogs } from "@/src/server/services/logs";
import { NO_FILTERS, type LogPurge } from "@/src/shared/lib/schemas/logs";

// Log purge - deletes log entries on demand from the Logs page, and records
// that it did. The record is written after the deletion, so it survives the
// purge it describes, and a log emptied by a purge still shows when it was.

/** Deletes the entries a purge covers, and records the purge.
 *
 * A purge of every entry ignores the filters, the search and the range among
 * them. Either way only entries written up to the moment the confirmation's
 * counts were read are deleted, so one written in the meantime is kept and the
 * count confirmed stays true.
 *
 * Waits for the record to reach the table before returning, so the page
 * refreshed after a purge shows it.
 *
 * @param purge What to purge, as the confirmation chose it.
 * @returns How many entries were deleted.
 */
export async function purgeLogs(purge: LogPurge): Promise<number> {
  const { q, level, source, range } = purge.scope === "all" ? NO_FILTERS : purge;
  const removed = await deleteLogs({ q, level, source, range }, purge.readAt);

  logger.activity.warn("log.purged", "Log entries purged", {
    scope: purge.scope,
    removed,
    search: q,
    level,
    source,
    range,
  });
  await flushLogs();
  return removed;
}
