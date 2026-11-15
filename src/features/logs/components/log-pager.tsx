import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { LogPage } from "@/src/server/services/logs";
import { Button } from "@/src/shared/components/ui/button";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { pageRange } from "@/src/features/logs/lib/log-format";
import { logsHref } from "@/src/features/logs/lib/log-links";

/** One of the pager's buttons: a link to the next page along, or a dimmed button at either end.
 *
 * A link cannot be disabled, so where there is no page to go to a disabled
 * button stands in its place. A screen reader then still finds both buttons,
 * and hears the missing one as unavailable rather than wondering where it went.
 */
function PageLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (href === null) {
    return (
      <Button type="button" variant="outline" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/** The Newer and Older buttons below the list, and which entries the page shows.
 *
 * Each button links to the page's address with the same filters, so paging
 * works with the back button and a page can be shared like the filters can.
 * Newer leads back towards the top of the log, as the list runs newest first.
 * Shown only once the matching entries fill more than one page.
 */
export function LogPager({ page, filters }: { page: LogPage; filters: LogFilters }) {
  if (page.pageCount <= 1) return null;

  const newer = page.page > 1 ? logsHref({ ...filters, page: page.page - 1 }) : null;
  const older = page.page < page.pageCount ? logsHref({ ...filters, page: page.page + 1 }) : null;

  return (
    <nav
      aria-label="Log pages"
      className="text-text-3 mt-3.5 flex items-center justify-between gap-3 text-[13.5px]"
    >
      <p className="tabular-nums">{pageRange(page.page, page.matching)}</p>
      <div className="flex gap-1.5">
        <PageLink href={newer}>
          <ChevronLeft aria-hidden className="size-3.5" />
          Newer
        </PageLink>
        <PageLink href={older}>
          Older
          <ChevronRight aria-hidden className="size-3.5" />
        </PageLink>
      </div>
    </nav>
  );
}
