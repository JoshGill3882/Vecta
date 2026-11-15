import { LOG_LEVELS, LOG_SOURCES, type LogFilters } from "@/src/shared/lib/schemas/logs";

/** Writes the address of the Logs page with a set of filters, and a page of them.
 *
 * Choices are written in the menus' order, whatever order they were picked in,
 * so the same filters always make the same address: going back lands on a
 * page already seen, and a shared link reads the same for everyone. An empty
 * filter and the first page are left out, so an unfiltered log is plain
 * `/logs`.
 *
 * @param filters The levels and sources to show, and optionally which page.
 * @returns The address, such as `/logs?level=warn&level=error&source=auth`.
 */
export function logsHref(
  filters: Pick<LogFilters, "level" | "source"> & { page?: number }
): string {
  const params = new URLSearchParams();
  for (const level of LOG_LEVELS) {
    if (filters.level.includes(level)) params.append("level", level);
  }
  for (const source of LOG_SOURCES) {
    if (filters.source.includes(source)) params.append("source", source);
  }
  if (filters.page !== undefined && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query === "" ? "/logs" : `/logs?${query}`;
}
