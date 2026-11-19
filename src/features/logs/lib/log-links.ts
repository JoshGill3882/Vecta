import type { ExportFormat } from "@/src/server/log-export";
import { LOG_LEVELS, LOG_SOURCES, type LogNarrowing } from "@/src/shared/lib/schemas/logs";

/** Writes the filters as query-string parameters.
 *
 * The search comes first, then the levels and sources in the menus' order,
 * whatever order they were picked in, then the range, so the same filters
 * always make the same address. A filter that is off is left out.
 *
 * @param filters The filters to write.
 * @returns The parameters, such as `q=milk&level=warn&level=error&range=7d`.
 */
function filterParams(filters: LogNarrowing): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== "") params.set("q", q);
  for (const level of LOG_LEVELS) {
    if (filters.level.includes(level)) params.append("level", level);
  }
  for (const source of LOG_SOURCES) {
    if (filters.source.includes(source)) params.append("source", source);
  }
  if (filters.range !== null) params.set("range", filters.range);
  return params;
}

/** Writes the address of the Logs page with a set of filters, and a page of them.
 *
 * The same filters always make the same address, so going back lands on a
 * page already seen and a shared link reads the same for everyone. A filter
 * that is off and the first page are left out, so an unfiltered log is plain
 * `/logs`.
 *
 * @param filters The filters to show, and optionally which page.
 * @returns The address, such as `/logs?q=milk&level=warn&source=auth`.
 */
export function logsHref(filters: LogNarrowing & { page?: number }): string {
  const params = filterParams(filters);
  if (filters.page !== undefined && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query === "" ? "/logs" : `/logs?${query}`;
}

/** Writes the address that downloads the entries a set of filters matches.
 *
 * @param filters The filters the export follows. A page, if given, is ignored.
 * @param format The file's format.
 * @param readAt When the page's counts were read, as an ISO 8601 timestamp,
 *   to leave out entries written since. Omitted, the export holds every match.
 * @returns The address, such as `/api/logs/export?format=csv&level=error`.
 */
export function logExportHref(
  filters: LogNarrowing,
  format: ExportFormat,
  readAt?: string
): string {
  const params = new URLSearchParams({ format });
  for (const [name, value] of filterParams(filters)) params.append(name, value);
  if (readAt !== undefined) params.set("readAt", readAt);
  return `/api/logs/export?${params}`;
}
