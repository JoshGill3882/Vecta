import { describe, it, expect } from "vitest";

import { contrast, over, token } from "@/test/support/contrast";

/*
 * Every due pill must meet WCAG AA (4.5:1) for its text, measured against what it
 * actually sits on: its own tint over the card. The due-date filter's coloured
 * options must meet it against the menu.
 *
 * The pairs below mirror DUE_STYLES in due-pill.tsx and DUE_OPTIONS in
 * due-options.ts. They are written out rather than parsed from the class
 * strings, which would test a Tailwind parser more than the palette; a change
 * to either should change these tables with it.
 */

describe("due pill contrast against the card", () => {
  it.each([
    // [state, text token, tint token, tint strength]
    ["overdue", "destructive", "destructive", 0.1],
    ["today", "brand-orange", "brand-orange", 0.15],
    ["soon", "text-2", "surface-2", 1],
    ["future", "text-3", null, 0],
    ["done", "text-3", null, 0],
  ] as const)("%s clears 4.5:1", (_, text, tint, strength) => {
    const card = token("card");
    const ground = tint ? over(token(tint), card, strength) : card;
    expect(contrast(token(text), ground)).toBeGreaterThanOrEqual(4.5);
  });

  // Why the overdue tint is 10%: a stronger tint darkens the ground under the red
  // text until it no longer holds 4.5:1.
  it("would fail with a 15% overdue tint", () => {
    const ground = over(token("destructive"), token("card"), 0.15);
    expect(contrast(token("destructive"), ground)).toBeLessThan(4.5);
  });
});

describe("due filter option contrast against the menu", () => {
  it.each([
    // [option, text token]
    ["overdue", "destructive"],
    ["today", "brand-orange"],
  ] as const)("%s clears 4.5:1", (_, text) => {
    expect(contrast(token(text), token("popover"))).toBeGreaterThanOrEqual(4.5);
  });

  // Why a highlighted row drops the colour for the row's own text: against the
  // highlight, in the menu and in the sheet, the overdue red falls short.
  it.each(["accent", "surface-3"] as const)(
    "would fail as overdue text on a row highlighted with %s",
    (highlight) => {
      expect(contrast(token("destructive"), token(highlight))).toBeLessThan(4.5);
    }
  );
});
