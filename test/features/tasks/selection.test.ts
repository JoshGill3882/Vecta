import { describe, it, expect } from "vitest";

import { toggled } from "@/src/features/tasks/lib/selection";

describe("toggled", () => {
  it("adds an option that is not selected", () => {
    expect([...toggled(new Set(["a"]), "b")]).toEqual(["a", "b"]);
  });

  it("removes an option that is selected", () => {
    expect([...toggled(new Set(["a", "b"]), "a")]).toEqual(["b"]);
  });

  // Uncategorised is stored as `null`, so it has to toggle like any other id.
  it("toggles null like any other option", () => {
    expect(toggled(new Set<string | null>(), null).has(null)).toBe(true);
    expect(toggled(new Set<string | null>([null]), null).has(null)).toBe(false);
  });

  // React compares state by identity: a mutated set would look unchanged and
  // never re-render the controls that show it.
  it("returns a new set and leaves the input untouched", () => {
    const selection = new Set(["a"]);
    const next = toggled(selection, "b");

    expect(next).not.toBe(selection);
    expect([...selection]).toEqual(["a"]);
  });
});
