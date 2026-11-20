import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  LOG_KINDS,
  LOG_LEVELS,
  LOG_RANGES,
  LOG_SEARCH_MAX,
  LOG_SOURCES,
  NO_FILTERS,
  PURGE_SCOPES,
  RANGE_SPANS,
  isFiltered,
  logFiltersFromParams,
  logFiltersSchema,
  logPurgeSchema,
  logWriteSchema,
} from "@/src/shared/lib/schemas/logs";

const validEntry = {
  kind: "activity",
  level: "info",
  event: "task.deleted",
  message: "Deleted the task “Renew the certificate”",
};

describe("logWriteSchema", () => {
  it("accepts a valid entry without detail", () => {
    expect(logWriteSchema.safeParse(validEntry).success).toBe(true);
  });

  it("accepts a valid entry with an object as detail", () => {
    const entry = { ...validEntry, detail: { id: "t1", title: "Renew", tags: ["a"], n: 2 } };
    expect(logWriteSchema.parse(entry).detail).toEqual(entry.detail);
  });

  describe("kind", () => {
    it.each([...LOG_KINDS])("accepts %s", (kind) => {
      expect(logWriteSchema.safeParse({ ...validEntry, kind }).success).toBe(true);
    });

    it.each(["Activity", "audit", "", undefined])("rejects %s", (kind) => {
      expect(logWriteSchema.safeParse({ ...validEntry, kind }).success).toBe(false);
    });
  });

  describe("level", () => {
    it("lists the levels from least to most severe", () => {
      expect(LOG_LEVELS).toEqual(["debug", "info", "warn", "error"]);
    });

    it.each([...LOG_LEVELS])("accepts %s", (level) => {
      expect(logWriteSchema.safeParse({ ...validEntry, level }).success).toBe(true);
    });

    it.each(["warning", "fatal", "INFO", undefined])("rejects %s", (level) => {
      expect(logWriteSchema.safeParse({ ...validEntry, level }).success).toBe(false);
    });
  });

  describe("event", () => {
    it.each(["task.deleted", "action.unexpected_error", "auth.sign_in.failed", "server.v2"])(
      "accepts %s",
      (event) => {
        expect(logWriteSchema.safeParse({ ...validEntry, event }).success).toBe(true);
      }
    );

    it.each([
      "deleted", // a single word says what happened but not to what
      "Task.deleted",
      "task deleted",
      "task.",
      ".deleted",
      "task..deleted",
      "task.2deleted",
      "",
    ])("rejects %j with a field-level message", (event) => {
      const result = logWriteSchema.safeParse({ ...validEntry, event });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(z.flattenError(result.error).fieldErrors.event).toContain(
          "Use lowercase words joined by dots, such as task.deleted"
        );
      }
    });
  });

  describe("message", () => {
    it("rejects an empty message with a field-level message", () => {
      const result = logWriteSchema.safeParse({ ...validEntry, message: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(z.flattenError(result.error).fieldErrors.message).toContain(
          "A log entry needs a message"
        );
      }
    });
  });

  describe("detail", () => {
    it.each([
      ["a string", "id t1"],
      ["a number", 42],
      ["an array", ["t1"]],
      ["null", null],
    ])("rejects %s", (_, detail) => {
      expect(logWriteSchema.safeParse({ ...validEntry, detail }).success).toBe(false);
    });
  });
});

describe("logFiltersSchema", () => {
  it("reads an empty query string as no filters, on the first page", () => {
    expect(logFiltersSchema.parse({})).toEqual({
      q: "",
      level: [],
      source: [],
      range: null,
      page: 1,
    });
  });

  it("reads the search, trimmed, keeping its case for the page to show", () => {
    expect(logFiltersSchema.parse({ q: "  Buy Milk " }).q).toBe("Buy Milk");
  });

  it("keeps a search's wildcard and pattern characters as they were typed", () => {
    expect(logFiltersSchema.parse({ q: "50% a_b .*" }).q).toBe("50% a_b .*");
  });

  it.each([
    ["a search", "q", "milk"],
    ["a range", "range", "7d"],
  ])("reads %s given as a list of one as that one value", (_, field, value) => {
    expect(logFiltersSchema.parse({ [field]: [value] })).toMatchObject({ [field]: value });
  });

  it(`accepts a search of ${LOG_SEARCH_MAX} characters`, () => {
    const q = "a".repeat(LOG_SEARCH_MAX);
    expect(logFiltersSchema.parse({ q }).q).toBe(q);
  });

  it.each([
    ["a search longer than the limit", "a".repeat(LOG_SEARCH_MAX + 1)],
    ["a repeated search", ["milk", "eggs"]],
  ])("clears the search for %s rather than refusing", (_, q) => {
    expect(logFiltersSchema.parse({ q, level: "warn" })).toMatchObject({ q: "", level: ["warn"] });
  });

  it("lists the ranges from the shortest", () => {
    expect(LOG_RANGES).toEqual(["24h", "7d", "30d"]);
  });

  it.each([...LOG_RANGES])("accepts the range %s", (range) => {
    expect(logFiltersSchema.parse({ range }).range).toBe(range);
  });

  it.each([
    ["an unknown range", "1y"],
    ["Any time's name", "any"],
    ["a range in the wrong case", "7D"],
    ["a repeated range", ["7d", "30d"]],
    ["an empty range", ""],
  ])("reads %s as any time rather than refusing", (_, range) => {
    expect(logFiltersSchema.parse({ range, source: "auth" })).toMatchObject({
      range: null,
      source: ["auth"],
    });
  });

  it("lists the sources in the order the page shows them", () => {
    expect(LOG_SOURCES).toEqual(["auth", "tasks", "categories", "system"]);
  });

  it("reads a parameter given once as a list of one", () => {
    expect(logFiltersSchema.parse({ level: "warn", source: "auth" })).toMatchObject({
      level: ["warn"],
      source: ["auth"],
    });
  });

  it("reads a repeated parameter as a list, in the order given", () => {
    const filters = logFiltersSchema.parse({
      level: ["error", "warn"],
      source: ["tasks", "system"],
    });

    expect(filters).toMatchObject({ level: ["error", "warn"], source: ["tasks", "system"] });
  });

  it.each([...LOG_LEVELS])("accepts the level %s", (level) => {
    expect(logFiltersSchema.parse({ level }).level).toEqual([level]);
  });

  it.each([...LOG_SOURCES])("accepts the source %s", (source) => {
    expect(logFiltersSchema.parse({ source }).source).toEqual([source]);
  });

  it.each([
    ["an unknown level", { level: "fatal" }, "level"],
    ["a level in the wrong case", { level: "WARN" }, "level"],
    ["one unknown level among known ones", { level: ["warn", "fatal"] }, "level"],
    ["an unknown source", { source: "settings" }, "source"],
    ["an empty source", { source: "" }, "source"],
  ] as const)("clears the filter for %s rather than refusing", (_, query, field) => {
    const result = logFiltersSchema.safeParse(query);

    expect(result.success).toBe(true);
    expect(result.data?.[field]).toEqual([]);
  });

  it.each([
    ["2", 2],
    ["40", 40],
  ])("reads the page %j as %d", (page, expected) => {
    expect(logFiltersSchema.parse({ page }).page).toBe(expected);
  });

  it.each(["0", "-1", "1.5", "two", "", ["2", "3"]])(
    "opens the first page for %j rather than refusing",
    (page) => {
      expect(logFiltersSchema.parse({ page }).page).toBe(1);
    }
  );

  it("keeps the other filters when the page is unreadable", () => {
    expect(logFiltersSchema.parse({ level: "error", page: "x" })).toEqual({
      q: "",
      level: ["error"],
      source: [],
      range: null,
      page: 1,
    });
  });
});

describe("logFiltersFromParams", () => {
  it("reads a query string with nothing in it as no filters, on the first page", () => {
    expect(logFiltersFromParams(new URLSearchParams())).toEqual({ ...NO_FILTERS, page: 1 });
  });

  it("reads every value of a repeated level or source", () => {
    const params = new URLSearchParams("level=warn&level=error&source=auth&source=system");
    expect(logFiltersFromParams(params)).toMatchObject({
      level: ["warn", "error"],
      source: ["auth", "system"],
    });
  });

  it("reads a search and a range given once", () => {
    const params = new URLSearchParams("q=+milk+&range=7d");
    expect(logFiltersFromParams(params)).toMatchObject({ q: "milk", range: "7d" });
  });

  it("clears a repeated search or range, as the page does, rather than keeping the first", () => {
    const params = new URLSearchParams("q=milk&q=eggs&range=24h&range=7d&level=info");
    expect(logFiltersFromParams(params)).toMatchObject({ q: "", range: null, level: ["info"] });
  });

  it("leaves out a page number, since a route acts on every match", () => {
    expect(logFiltersFromParams(new URLSearchParams("page=4")).page).toBe(1);
  });
});

describe("RANGE_SPANS", () => {
  it.each([
    ["24h", 24],
    ["7d", 7 * 24],
    ["30d", 30 * 24],
  ] as const)("reaches %s back as %d hours", (range, hours) => {
    expect(RANGE_SPANS[range]).toBe(hours * 60 * 60 * 1000);
  });
});

describe("isFiltered", () => {
  it("is off with no filters", () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it.each([
    ["a search", { q: "milk" }],
    ["a level", { level: ["warn" as const] }],
    ["a source", { source: ["auth" as const] }],
    ["a range", { range: "7d" as const }],
  ])("is on with %s", (_, change) => {
    expect(isFiltered({ ...NO_FILTERS, ...change })).toBe(true);
  });

  it("is off with a search of only spaces, which matches every entry", () => {
    expect(isFiltered({ ...NO_FILTERS, q: "   " })).toBe(false);
  });
});

describe("logPurgeSchema", () => {
  const READ_AT = "2026-11-17T19:30:00.000Z";

  it("lists the scopes in the order the confirmation offers them", () => {
    expect(PURGE_SCOPES).toEqual(["filtered", "all"]);
  });

  it("reads a purge of every entry, with when its count was read as a moment", () => {
    expect(logPurgeSchema.parse({ scope: "all", readAt: READ_AT })).toEqual({
      scope: "all",
      readAt: new Date(READ_AT),
    });
  });

  it("drops the filters from a purge of every entry, which ignores them", () => {
    const purge = logPurgeSchema.parse({
      scope: "all",
      q: "milk",
      level: ["warn"],
      source: ["auth"],
      range: "7d",
      readAt: READ_AT,
    });

    expect(purge).toEqual({ scope: "all", readAt: new Date(READ_AT) });
  });

  it.each([
    ["a search", { ...NO_FILTERS, q: "milk" }],
    ["a level", { ...NO_FILTERS, level: ["warn", "error"] }],
    ["a source", { ...NO_FILTERS, source: ["auth"] }],
    ["a range", { ...NO_FILTERS, range: "24h" }],
    ["all four", { q: "milk", level: ["error"], source: ["tasks", "system"], range: "30d" }],
  ])("reads a filtered purge with %s on", (_, filters) => {
    expect(logPurgeSchema.parse({ scope: "filtered", ...filters, readAt: READ_AT })).toEqual({
      scope: "filtered",
      ...filters,
      readAt: new Date(READ_AT),
    });
  });

  it("trims a filtered purge's search, as the page does", () => {
    const purge = logPurgeSchema.parse({
      scope: "filtered",
      ...NO_FILTERS,
      q: "  milk ",
      readAt: READ_AT,
    });

    expect(purge).toMatchObject({ q: "milk" });
  });

  it.each([
    ["no filter on", NO_FILTERS],
    ["only a search of spaces", { ...NO_FILTERS, q: "   " }],
  ])("refuses a filtered purge with %s, which would delete every entry", (_, filters) => {
    const result = logPurgeSchema.safeParse({ scope: "filtered", ...filters, readAt: READ_AT });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(z.flattenError(result.error).formErrors).toContain(
        "Turn a filter on to purge what it matches"
      );
    }
  });

  it.each([
    ["an unknown level", { ...NO_FILTERS, level: ["fatal"] }],
    ["one unknown level among known ones", { ...NO_FILTERS, level: ["warn", "fatal"] }],
    ["a level in the wrong case", { ...NO_FILTERS, level: ["WARN"] }],
    ["an unknown source", { ...NO_FILTERS, source: ["settings"] }],
    ["a level given once rather than as a list", { ...NO_FILTERS, level: "warn" }],
    ["an unknown range", { ...NO_FILTERS, level: ["warn"], range: "1y" }],
    ["Any time's name as a range", { ...NO_FILTERS, level: ["warn"], range: "any" }],
    ["a search longer than the limit", { ...NO_FILTERS, q: "a".repeat(LOG_SEARCH_MAX + 1) }],
    ["no search", { level: ["warn"], source: [], range: null }],
    ["no range", { q: "", level: ["warn"], source: [] }],
    ["no filters at all", {}],
  ])("refuses a filtered purge with %s, rather than clearing it", (_, filters) => {
    expect(
      logPurgeSchema.safeParse({ scope: "filtered", ...filters, readAt: READ_AT }).success
    ).toBe(false);
  });

  it.each([
    ["no scope", { readAt: READ_AT }],
    ["an unknown scope", { scope: "older", readAt: READ_AT }],
    ["no moment", { scope: "all" }],
    ["a moment that is not a timestamp", { scope: "all", readAt: "yesterday" }],
    ["a moment as a number", { scope: "all", readAt: Date.parse(READ_AT) }],
    ["a date without a time", { scope: "all", readAt: "2026-11-17" }],
  ])("refuses %s", (_, purge) => {
    expect(logPurgeSchema.safeParse(purge).success).toBe(false);
  });
});
