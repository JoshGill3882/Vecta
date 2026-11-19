import { ScrollText, Search } from "lucide-react";

import type { LogPage } from "@/src/server/services/logs";
import { EmptyState } from "@/src/shared/components/empty-state";
import type { RetentionStatusDTO } from "@/src/shared/lib/dtos/settings";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { normaliseQuery } from "@/src/shared/lib/text-search";
import { entryCount, logDate } from "@/src/features/logs/lib/log-format";

import { ClearFiltersLink } from "./clear-filters-link";
import { ExportMenu } from "./export-menu";
import { LogFilterBar } from "./log-filter-bar";
import { LogList } from "./log-list";
import { LogPager } from "./log-pager";
import { PurgeDialog } from "./purge-dialog";
import { RetentionCard } from "./retention-card";

/** Logs view - the content of the `/logs` route.
 *
 * `page.tsx` stays thin (auth + data); this owns the presentation. The heading
 * counts every entry, whatever the filters, and dates the oldest in the
 * server's time zone, as the task list's due dates are. The list's day
 * headings and times are read in the same zone, from one moment taken here,
 * and so is the Retention card's last run.
 */
export function LogsView({
  page,
  filters,
  retention,
}: {
  page: LogPage;
  filters: LogFilters;
  retention: RetentionStatusDTO;
}) {
  const now = new Date();

  return (
    <section>
      <header className="mb-[18px] flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[23px] font-semibold tracking-[-0.02em]">Logs</h1>
          <p className="text-text-3 mt-1 text-[13.5px]">
            {entryCount(page.total)}
            {page.oldest && (
              <>
                {" since "}
                <time dateTime={page.oldest}>{logDate(page.oldest)}</time>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ExportMenu page={page} filters={filters} />
          <PurgeDialog page={page} filters={filters} />
        </div>
      </header>

      <RetentionCard status={retention} now={now} />

      <LogFilterBar page={page} filters={filters} />

      {page.entries.length > 0 ? (
        <LogList entries={page.entries} now={now} needle={normaliseQuery(filters.q)} />
      ) : page.total === 0 ? (
        <EmptyState icon={ScrollText} heading="No log entries">
          New activity will appear here as it happens.
        </EmptyState>
      ) : (
        // A page past the last shows the last, so a log with entries can only
        // show none when the filters match none of them.
        <EmptyState icon={Search} heading="No matching entries" action={<ClearFiltersLink />}>
          Nothing matches the search and filters you have on.
        </EmptyState>
      )}

      <LogPager page={page} filters={filters} />
    </section>
  );
}
