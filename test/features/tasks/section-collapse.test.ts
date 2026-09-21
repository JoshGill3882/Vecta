import { describe, it, expect } from "vitest";

import {
  parseCollapsed,
  SECTION_COLLAPSE_DEFAULTS,
} from "@/src/features/tasks/lib/section-collapse";

describe("parseCollapsed", () => {
  it("accepts a complete map", () => {
    const stored = { open: true, in_progress: false, closed: false };
    expect(parseCollapsed(stored)).toEqual(stored);
  });

  it("falls back per status where a value is missing", () => {
    // A status added in a later version is absent from an older stored value,
    // and must not arrive as `undefined` in a section's open state.
    expect(parseCollapsed({ open: true })).toEqual({
      ...SECTION_COLLAPSE_DEFAULTS,
      open: true,
    });
  });

  it("falls back per status where a value is not a boolean", () => {
    // The cookie is editable by hand, so any shape can reach here.
    expect(parseCollapsed({ open: "yes", in_progress: 1, closed: null })).toEqual(
      SECTION_COLLAPSE_DEFAULTS
    );
  });

  it("ignores a status it does not know", () => {
    // A status removed in a later version leaves its key behind in the cookie.
    expect(parseCollapsed({ open: true, archived: true })).toEqual({
      ...SECTION_COLLAPSE_DEFAULTS,
      open: true,
    });
  });

  it("rejects a value that is not an object", () => {
    for (const value of [null, undefined, "closed", 42, true]) {
      expect(parseCollapsed(value)).toBeUndefined();
    }
  });

  it("yields the defaults for an array", () => {
    // An array is an object, so it reaches the per-status reads and none of
    // them match. Equivalent to no preference, which is the right outcome.
    expect(parseCollapsed([])).toEqual(SECTION_COLLAPSE_DEFAULTS);
  });

  it("does not return the defaults object itself", () => {
    // A caller mutating the result must not rewrite the defaults for everyone.
    expect(parseCollapsed({})).not.toBe(SECTION_COLLAPSE_DEFAULTS);
  });
});
