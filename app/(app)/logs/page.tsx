import { requireSession } from "@/src/shared/lib/session";
import { getRetentionStatus } from "@/src/server/log-retention";
import { listLogPage } from "@/src/server/services/logs";
import { logFiltersSchema } from "@/src/shared/lib/schemas/logs";

import { LogsView } from "@/src/features/logs/components/logs-view";

/** The Logs route: authenticates, reads the filters from the URL, fetches one page and the retention, and hands off to the view.
 *
 * The filters live in the query string rather than in component state, so a
 * refresh, the back button or a shared link opens the same page of the log.
 */
export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const filters = logFiltersSchema.parse(await searchParams);
  const [page, retention] = await Promise.all([listLogPage(filters), getRetentionStatus()]);

  return <LogsView page={page} filters={filters} retention={retention} />;
}
