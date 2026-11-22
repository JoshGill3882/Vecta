import { describe, it, expect } from "vitest";

import { logExportHref, logNewCountHref, logsHref } from "@/src/features/logs/lib/log-links";
import {
  logFiltersSchema,
  NO_FILTERS,
  type LogFilters,
  type LogNarrowing,
} from "@/src/shared/lib/schemas/logs";

/** Builds a set of filters, with every filter off unless the case turns it on.
 *
 * @param change The filters the case turns on.
 * @returns The filters.
 */
function narrowing(change: Partial<LogNarrowing> = {}): LogNarrowing {
  return { ...NO_FILTERS, ...change };
}

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
    expect(logsHref(NO_FILTERS)).toBe("/logs");
    expect(logsHref({ ...NO_FILTERS, page: 1 })).toBe("/logs");
  });

  it("names each level and source picked", () => {
    expect(logsHref(narrowing({ level: ["error"], source: ["auth", "tasks"] }))).toBe(
      "/logs?level=error&source=auth&source=tasks"
    );
  });

  it("writes choices in the menus' order, whatever order they were picked in", () => {
    expect(
      logsHref(narrowing({ level: ["error", "debug", "warn"], source: ["system", "auth"] }))
    ).toBe("/logs?level=debug&level=warn&level=error&source=auth&source=system");
  });

  it("writes a choice picked twice once", () => {
    expect(logsHref(narrowing({ level: ["warn", "warn"] }))).toBe("/logs?level=warn");
  });

  it("names the page past the first", () => {
    expect(logsHref({ ...NO_FILTERS, page: 3 })).toBe("/logs?page=3");
    expect(logsHref({ ...narrowing({ level: ["info"] }), page: 2 })).toBe(
      "/logs?level=info&page=2"
    );
  });

  it("names the search, trimmed, and the range", () => {
    expect(logsHref(narrowing({ q: "  buy milk ", range: "7d" }))).toBe(
      "/logs?q=buy+milk&range=7d"
    );
  });

  it("leaves out a search of only spaces", () => {
    expect(logsHref(narrowing({ q: "   " }))).toBe("/logs");
  });

  it("puts the search first and the range after the levels and sources", () => {
    expect(
      logsHref({
        ...narrowing({ q: "milk", level: ["warn"], source: ["tasks"], range: "24h" }),
        page: 2,
      })
    ).toBe("/logs?q=milk&level=warn&source=tasks&range=24h&page=2");
  });

  it("escapes a search's characters, so they reach the page as typed", () => {
    expect(readBack(logsHref(narrowing({ q: "50% & a_b #1 ?x=y" }))).q).toBe("50% & a_b #1 ?x=y");
  });

  it.each([
    [{ ...NO_FILTERS, page: 1 }],
    [{ ...NO_FILTERS, level: ["warn"], page: 1 }],
    [{ ...NO_FILTERS, level: ["debug", "error"], source: ["categories"], page: 4 }],
    [{ ...NO_FILTERS, source: ["auth", "tasks", "categories", "system"], page: 2 }],
    [{ q: "Buy “milk”", level: ["info"], source: ["tasks"], range: "30d", page: 3 }],
  ] as LogFilters[][])("reads back as the same filters: %j", (filters) => {
    expect(readBack(logsHref(filters))).toEqual(filters);
  });
});

describe("logExportHref", () => {
  it("names only the format with no filters", () => {
    expect(logExportHref(NO_FILTERS, "csv")).toBe("/api/logs/export?format=csv");
    expect(logExportHref(NO_FILTERS, "json")).toBe("/api/logs/export?format=json");
  });

  it("carries the levels and sources picked, in the menus' order", () => {
    expect(
      logExportHref(narrowing({ level: ["error", "warn"], source: ["system", "auth"] }), "json")
    ).toBe("/api/logs/export?format=json&level=warn&level=error&source=auth&source=system");
  });

  it("carries the search and the range", () => {
    expect(logExportHref(narrowing({ q: "milk", range: "24h" }), "csv")).toBe(
      "/api/logs/export?format=csv&q=milk&range=24h"
    );
  });

  it("leaves out the page, since an export covers every match", () => {
    const filters: LogFilters = { ...narrowing({ level: ["info"] }), page: 4 };

    expect(logExportHref(filters, "csv")).toBe("/api/logs/export?format=csv&level=info");
  });

  it("adds when the page's counts were read, after the filters, when given", () => {
    expect(
      logExportHref(
        narrowing({ level: ["error"], range: "7d" }),
        "json",
        "2026-11-17T19:30:00.000Z"
      )
    ).toBe("/api/logs/export?format=json&level=error&range=7d&readAt=2026-11-17T19%3A30%3A00.000Z");
  });

  it("carries the same filters as the page's own address", () => {
    const filters: LogFilters = {
      q: "renamed",
      level: ["debug", "error"],
      source: ["categories"],
      range: "30d",
      page: 1,
    };
    const exportQuery = new URL(logExportHref(filters, "csv"), "http://vecta.test").searchParams;
    exportQuery.delete("format");

    expect(`/logs?${exportQuery}`).toBe(logsHref(filters));
  });
});

describe("logNewCountHref", () => {
  const READ_AT = "2026-11-20T08:15:42.123Z";

  it("names only the moment with no filters", () => {
    expect(logNewCountHref(NO_FILTERS, READ_AT)).toBe(
      "/api/logs/new?readAt=2026-11-20T08%3A15%3A42.123Z"
    );
  });

  it("carries the search, levels, sources and range, in the page's order, then the moment", () => {
    expect(
      logNewCountHref(
        narrowing({ q: "milk", level: ["error", "warn"], source: ["system", "auth"], range: "7d" }),
        READ_AT
      )
    ).toBe(
      "/api/logs/new?q=milk&level=warn&level=error&source=auth&source=system&range=7d&readAt=2026-11-20T08%3A15%3A42.123Z"
    );
  });

  it("leaves out the page, since new entries are counted across every page", () => {
    const filters: LogFilters = { ...narrowing({ level: ["info"] }), page: 4 };

    expect(logNewCountHref(filters, READ_AT)).toBe(
      "/api/logs/new?level=info&readAt=2026-11-20T08%3A15%3A42.123Z"
    );
  });

  it("carries the same filters as the page's own address", () => {
    const filters: LogFilters = {
      q: "renamed",
      level: ["debug", "error"],
      source: ["categories"],
      range: "30d",
      page: 1,
    };
    const query = new URL(logNewCountHref(filters, READ_AT), "http://vecta.test").searchParams;
    query.delete("readAt");

    expect(`/logs?${query}`).toBe(logsHref(filters));
  });
});
