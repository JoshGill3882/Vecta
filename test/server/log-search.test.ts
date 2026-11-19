import { describe, it, expect } from "vitest";

import { entryMatches } from "@/src/server/log-search";
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { normaliseQuery } from "@/src/shared/lib/text-search";

/** Builds an entry, with only the fields a case cares about given.
 *
 * @param change The fields the case sets.
 * @returns A complete entry.
 */
function entry(change: Partial<LogEntryDTO> = {}): LogEntryDTO {
  return {
    id: "e1",
    createdAt: "2026-11-19T10:00:00.000Z",
    kind: "activity",
    level: "info",
    event: "server.started",
    source: "system",
    message: "Server started",
    detail: null,
    ...change,
  };
}

/** Whether an entry matches a search as typed, normalised as the service normalises it.
 *
 * @param subject The entry.
 * @param query The search as typed.
 * @returns Whether it matches.
 */
function matches(subject: LogEntryDTO, query: string): boolean {
  return entryMatches(subject, normaliseQuery(query));
}

const deleted = entry({
  event: "task.deleted",
  source: "tasks",
  message: "Task deleted",
  detail: { taskId: "cm3abc", title: "Buy milk" },
});

describe("entryMatches", () => {
  it("matches every entry with no search", () => {
    expect(matches(deleted, "")).toBe(true);
    expect(matches(deleted, "   ")).toBe(true);
  });

  it("matches the message the row shows", () => {
    // The row reads `Deleted “Buy milk”`, a phrase the table never stores.
    expect(matches(deleted, "deleted “buy")).toBe(true);
  });

  it("matches the stored message", () => {
    expect(matches(deleted, "task deleted")).toBe(true);
  });

  it("matches the event name", () => {
    expect(matches(deleted, "task.del")).toBe(true);
  });

  it("matches a value in the detail", () => {
    expect(matches(deleted, "cm3abc")).toBe(true);
  });

  it("does not match a detail key", () => {
    expect(matches(deleted, "taskid")).toBe(false);
  });

  it("does not match what no field holds", () => {
    expect(matches(deleted, "eggs")).toBe(false);
  });

  it("ignores case, accented letters included", () => {
    const accented = entry({ message: "Écrire le rapport" });

    expect(matches(accented, "BUY")).toBe(false);
    expect(matches(accented, "écrire")).toBe(true);
    expect(matches(accented, "ÉCRIRE LE")).toBe(true);
  });

  it.each([
    ["%", "50% done", "500 done"],
    ["_", "a_b", "axb"],
    [".*", "matches .* literally", "matches anything"],
    ["[", "the [draft", "the draft"],
    ["\\", "C:\\data", "C:/data"],
  ])("treats %j as itself, not a pattern", (query, holds, lacks) => {
    expect(matches(entry({ message: holds }), query)).toBe(true);
    expect(matches(entry({ message: lacks }), query)).toBe(false);
  });

  it("matches a quote in a detail value, which the stored JSON escapes", () => {
    expect(matches(entry({ detail: { title: 'Say "hi"' } }), '"hi"')).toBe(true);
  });

  it("matches a number in the detail", () => {
    expect(matches(entry({ event: "log.purged", detail: { removed: 1204 } }), "1204")).toBe(true);
  });

  it("matches values nested in objects and lists", () => {
    const nested = entry({
      detail: { changed: ["title", "dueAt"], error: { name: "TypeError", cause: { code: "E42" } } },
    });

    expect(matches(nested, "dueat")).toBe(true);
    expect(matches(nested, "typeerror")).toBe(true);
    expect(matches(nested, "e42")).toBe(true);
  });

  it.each([
    ["true", { flag: true }],
    ["false", { flag: false }],
    ["null", { title: null }],
  ])("does not match %j from a detail value that is not text or a number", (query, detail) => {
    expect(matches(entry({ detail }), query)).toBe(false);
  });

  it("matches a detail that was stored as something other than JSON", () => {
    expect(matches(entry({ detail: { unparsed: "not json at all" } }), "json at")).toBe(true);
  });

  it("does not match across two fields", () => {
    // "started" ends the message and "server" begins the event; together they
    // are not text any one field holds.
    expect(matches(entry(), "started server")).toBe(false);
  });
});
