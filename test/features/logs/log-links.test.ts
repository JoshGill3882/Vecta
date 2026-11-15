import { describe, it, expect } from "vitest";

import { logsHref } from "@/src/features/logs/lib/log-links";
import { logFiltersSchema, type LogFilters } from "@/src/shared/lib/schemas/logs";

const NONE = { level: [], source: [] };

/** Reads an address back the way the Logs page reads its URL.
 *
 * @param href An address `logsHref` wrote.
 * @returns The filters the page would show.
 */
function readBack(href: string): LogFilters {
  const params = new URL(href, "http://vecta.test").searchParams;
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return logFiltersSchema.parse(query);
}

describe("logsHref", () => {
  it("is plain /logs with no filters, on the first page", () => {
    expect(logsHref(NONE)).toBe("/logs");
    expect(logsHref({ ...NONE, page: 1 })).toBe("/logs");
  });

  it("names each level and source picked", () => {
    expect(logsHref({ level: ["error"], source: ["auth", "tasks"] })).toBe(
      "/logs?level=error&source=auth&source=tasks"
    );
  });

  it("writes choices in the menus' order, whatever order they were picked in", () => {
    expect(logsHref({ level: ["error", "debug", "warn"], source: ["system", "auth"] })).toBe(
      "/logs?level=debug&level=warn&level=error&source=auth&source=system"
    );
  });

  it("writes a choice picked twice once", () => {
    expect(logsHref({ level: ["warn", "warn"], source: [] })).toBe("/logs?level=warn");
  });

  it("names the page past the first", () => {
    expect(logsHref({ ...NONE, page: 3 })).toBe("/logs?page=3");
    expect(logsHref({ level: ["info"], source: [], page: 2 })).toBe("/logs?level=info&page=2");
  });

  it.each([
    [{ level: [], source: [], page: 1 }],
    [{ level: ["warn"], source: [], page: 1 }],
    [{ level: ["debug", "error"], source: ["categories"], page: 4 }],
    [{ level: [], source: ["auth", "tasks", "categories", "system"], page: 2 }],
  ] as LogFilters[][])("reads back as the same filters: %j", (filters) => {
    expect(readBack(logsHref(filters))).toEqual(filters);
  });
});
