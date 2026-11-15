import { describe, it, expect } from "vitest";

import { contrast, over, token } from "@/test/support/contrast";

/*
 * Every level badge must meet WCAG AA (4.5:1) for its text, measured against
 * its own ground. Each badge's ground is opaque - the quiet ones surface-2, the
 * tinted ones their tint mixed into the card - so it is the same whether the
 * row beneath is closed (the card) or open (surface-2).
 *
 * The pairs below mirror LEVEL_LABELS in log-meta.ts. They are written out
 * rather than parsed from the class strings, which would test a Tailwind parser
 * more than the palette; a change to either should change this table with it.
 */
describe("level badge contrast", () => {
  it.each([
    // [level, text token, tint token, tint strength over the card]
    ["debug", "text-2", "surface-2", 1],
    ["info", "text-2", "surface-2", 1],
    ["warn", "brand-orange", "brand-orange", 0.12],
    ["error", "destructive", "destructive", 0.1],
  ] as const)("%s clears 4.5:1", (_, text, tint, strength) => {
    const ground = over(token(tint), token("card"), strength);
    expect(contrast(token(text), ground)).toBeGreaterThanOrEqual(4.5);
  });

  // Why the tints are mixed into the card rather than laid over the row: over
  // an open row's surface-2, the Error tint takes its text below 4.5:1.
  it("would fail with the Error tint laid over an open row", () => {
    const ground = over(token("destructive"), token("surface-2"), 0.1);
    expect(contrast(token("destructive"), ground)).toBeLessThan(4.5);
  });
});
