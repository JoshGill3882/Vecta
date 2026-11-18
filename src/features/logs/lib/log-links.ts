import type { ExportFormat } from "@/src/server/log-export";
import { LOG_LEVELS, LOG_SOURCES, type LogFilters } from "@/src/shared/lib/schemas/logs";

/** The levels and sources picked, which is all an address's filters hold. */
type Choices = Pick<LogFilters, "level" | "source">;

/** Writes the levels and sources picked as query-string parameters.
 *
 * Choices are written in the menus' order, whatever order they were picked in,
 * so the same filters always make the same address.
 *
 * @param filters The levels and sources picked.
 * @returns The parameters, such as `level=warn&level=error&source=auth`.
 */
function choiceParams(filters: Choices): URLSearchParams {
  const params = new URLSearchParams();
  for (const level of LOG_LEVELS) {
    if (filters.level.includes(level)) params.append("level", level);
  }
  for (const source of LOG_SOURCES) {
    if (filters.source.includes(source)) params.append("source", source);
  }
  return params;
}

/** Writes the address of the Logs page with a set of filters, and a page of them.
 *
 * The same filters always make the same address, so going back lands on a
 * page already seen and a shared link reads the same for everyone. An empty
 * filter and the first page are left out, so an unfiltered log is plain
 * `/logs`.
 *
 * @param filters The levels and sources to show, and optionally which page.
 * @returns The address, such as `/logs?level=warn&level=error&source=auth`.
 */
export function logsHref(filters: Choices & { page?: number }): string {
  const params = choiceParams(filters);
  if (filters.page !== undefined && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query === "" ? "/logs" : `/logs?${query}`;
}

/** Writes the address that downloads the entries a set of filters matches.
 *
 * @param filters The levels and sources the export follows.
 * @param format The file's format.
 * @param readAt When the page's counts were read, as an ISO 8601 timestamp,
 *   to leave out entries written since. Omitted, the export holds every match.
 * @returns The address, such as `/api/logs/export?format=csv&level=error`.
 */
export function logExportHref(filters: Choices, format: ExportFormat, readAt?: string): string {
  const params = new URLSearchParams({ format });
  for (const [name, value] of choiceParams(filters)) params.append(name, value);
  if (readAt !== undefined) params.set("readAt", readAt);
  return `/api/logs/export?${params}`;
}
