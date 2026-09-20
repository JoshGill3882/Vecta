import { describe, it, expect } from "vitest";

import { describeNoMatches } from "@/src/features/tasks/components/tasks-empty-state";

describe("describeNoMatches", () => {
  it("blames the query when only the query is narrowing", () => {
    expect(describeNoMatches("invoice", false)).toEqual({
      detail: "Nothing matches “invoice”.",
      action: "Clear search",
    });
  });

  it("blames the filter when only the filter is narrowing", () => {
    // The message must not mention a search here. Naming the wrong control
    // sends the reader to clear something that was never set.
    expect(describeNoMatches("", true)).toEqual({
      detail: "No tasks in the selected categories.",
      action: "Clear filters",
    });
  });

  it("names both when both are narrowing", () => {
    expect(describeNoMatches("invoice", true)).toEqual({
      detail: "Nothing matches “invoice” in the selected categories.",
      action: "Clear search and filters",
    });
  });

  it("shows the query trimmed", () => {
    expect(describeNoMatches("  invoice  ", false).detail).toBe("Nothing matches “invoice”.");
  });

  it("treats a whitespace-only query as no query", () => {
    // Whitespace is not something the reader can see they typed, so a message
    // quoting it would describe a search they cannot find to clear.
    expect(describeNoMatches("   ", true)).toEqual({
      detail: "No tasks in the selected categories.",
      action: "Clear filters",
    });
  });

  it("ends every message with exactly one full stop", () => {
    // The sentence is supplied complete. It was rendered with a second full stop
    // appended for a while, and nothing failed when it was.
    for (const [query, byCategory] of [
      ["invoice", false],
      ["", true],
      ["invoice", true],
    ] as const) {
      expect(describeNoMatches(query, byCategory).detail).toMatch(/[^.]\.$/);
    }
  });
});
