import type { LogPage } from "@/src/server/services/logs";
import { entryCount, logDate } from "@/src/features/logs/lib/log-format";

/** Logs view - the content of the `/logs` route.
 *
 * `page.tsx` stays thin (auth + data); this owns the presentation. The heading
 * counts every entry, whatever the filters, and dates the oldest in the
 * server's time zone, as the task list's due dates are.
 */
export function LogsView({ page }: { page: LogPage }) {
  return (
    <section>
      <header className="mb-[18px]">
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
      </header>
    </section>
  );
}
