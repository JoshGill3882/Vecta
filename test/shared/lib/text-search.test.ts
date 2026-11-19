import { describe, it, expect } from "vitest";

import { findMatches, normaliseQuery } from "@/src/shared/lib/text-search";

describe("normaliseQuery", () => {
  it("trims and lowercases", () => {
    expect(normaliseQuery("  Deploy The Thing  ")).toBe("deploy the thing");
  });

  it("reduces a whitespace-only query to the empty string", () => {
    // The empty string is the signal every caller reads as "no query", so a
    // query of spaces must not be mistaken for one that matches nothing.
    expect(normaliseQuery("   \t\n ")).toBe("");
  });
});

describe("findMatches", () => {
  it("returns an index pair per occurrence", () => {
    expect(findMatches("banana", "an")).toEqual([
      [1, 3],
      [3, 5],
    ]);
  });

  it("indexes into the original string, so the caller keeps its casing", () => {
    const text = "Renew the TLS certificate";
    const [[start, end]] = findMatches(text, "tls");
    expect(text.slice(start, end)).toBe("TLS");
  });

  it("does not overlap matches", () => {
    // "aa" appears at 0, 1 and 2 if overlaps count. The caller slices these
    // ranges in sequence, so overlapping pairs would duplicate characters.
    expect(findMatches("aaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it("returns nothing for an empty needle", () => {
    expect(findMatches("anything", "")).toEqual([]);
  });

  it("treats regex metacharacters as literal text", () => {
    // The whole reason this is indexOf and not a RegExp: `.*` must find the two
    // characters, not every character.
    expect(findMatches("Renew the certificate", ".*")).toEqual([]);
    expect(findMatches("Wildcard .* in a title", ".*")).toEqual([[9, 11]]);
  });

  it("finds a literal open bracket, which would be an invalid pattern", () => {
    // An unclosed `[` throws when compiled as a regex; here it is just a
    // character, and a query mid-typing routinely contains one.
    expect(findMatches("Fix the [urgent] bug", "[urgent")).toEqual([[8, 15]]);
  });

  it("declines rather than mis-slices when lowercasing changes the length", () => {
    // "İ" (U+0130) lowercases to two code units in JS, which would slide every
    // index after it out of step with the original string. No highlight is the
    // intended outcome, not a highlight in the wrong place.
    const text = "İstanbul office move";
    expect(text.toLowerCase().length).not.toBe(text.length);
    expect(findMatches(text, "office")).toEqual([]);
  });
});
