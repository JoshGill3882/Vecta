import { describe, it, expect } from "vitest";

import { describeNoMatches } from "@/src/features/tasks/components/tasks-empty-state";

const none = { byDue: false, byCategory: false };
const byCategory = { byDue: false, byCategory: true };
const byDue = { byDue: true, byCategory: false };
const byBoth = { byDue: true, byCategory: true };

describe("describeNoMatches", () => {
  it("blames the query when only the query is narrowing", () => {
    expect(describeNoMatches("invoice", none)).toEqual({
      detail: "Nothing matches “invoice”.",
      action: "Clear search",
    });
  });

  it("blames the category filter when only it is narrowing", () => {
    // The message must not mention a search here. Naming the wrong control
    // sends the reader to clear something that was never set.
    expect(describeNoMatches("", byCategory)).toEqual({
      detail: "No tasks in the selected categories.",
      action: "Clear filters",
    });
  });

  it("blames the due-date filter when only it is narrowing", () => {
    // Nor may it blame categories for what a due-date option did.
    expect(describeNoMatches("", byDue)).toEqual({
      detail: "No tasks in the selected due dates.",
      action: "Clear filters",
    });
  });

  it("names both filters, in the toolbar's order, when both are narrowing", () => {
    expect(describeNoMatches("", byBoth)).toEqual({
      detail: "No tasks in the selected due dates and categories.",
      action: "Clear filters",
    });
  });

  it("names the search and a filter when both are narrowing", () => {
    expect(describeNoMatches("invoice", byCategory)).toEqual({
      detail: "Nothing matches “invoice” in the selected categories.",
      action: "Clear search and filters",
    });
    expect(describeNoMatches("invoice", byDue)).toEqual({
      detail: "Nothing matches “invoice” in the selected due dates.",
      action: "Clear search and filters",
    });
  });

  it("names the search and both filters when all three are narrowing", () => {
    expect(describeNoMatches("invoice", byBoth)).toEqual({
      detail: "Nothing matches “invoice” in the selected due dates and categories.",
      action: "Clear search and filters",
    });
  });

  it("shows the query trimmed", () => {
    expect(describeNoMatches("  invoice  ", none).detail).toBe("Nothing matches “invoice”.");
  });

  it("treats a whitespace-only query as no query", () => {
    // Whitespace is not something the reader can see they typed, so a message
    // quoting it would describe a search they cannot find to clear.
    expect(describeNoMatches("   ", byCategory)).toEqual({
      detail: "No tasks in the selected categories.",
      action: "Clear filters",
    });
  });

  it("ends every message with exactly one full stop", () => {
    // The sentence is supplied complete. It was rendered with a second full stop
    // appended for a while, and nothing failed when it was.
    for (const query of ["invoice", ""]) {
      for (const filters of [none, byCategory, byDue, byBoth]) {
        expect(describeNoMatches(query, filters).detail).toMatch(/[^.]\.$/);
      }
    }
  });
});
