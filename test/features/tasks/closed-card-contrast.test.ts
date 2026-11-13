import { describe, it, expect } from "vitest";

import { contrast, over, token } from "@/test/support/contrast";

/*
 * A closed card recedes by being filled with the page background instead of
 * the card surface, so every piece of its text is measured against that fill.
 * The category chip is left out: coloured chip text is an accepted contrast
 * trade-off on every card, open or closed.
 *
 * The pairs mirror the closed branches of task-card.tsx, STATUS_ACCENT.closed
 * in task-status.ts and DUE_STYLES.done in due-pill.tsx; a change to any of
 * them should change this table with it.
 */

const fill = token("background");

describe("closed card text contrast", () => {
  it.each([
    // [text, text token, tint strength under it]
    ["struck-through title", "text-2", 0],
    ["timestamp", "text-faint", 0],
    ['"Closed" badge', "status-closed", 0.1],
    ['"Was due" pill', "text-3", 0],
  ] as const)("the %s clears 4.5:1", (_, text, tint) => {
    const ground = tint ? over(token(text), fill, tint) : fill;
    expect(contrast(token(text), ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("sits on a different fill from an open card", () => {
    expect(fill).not.toEqual(token("card"));
  });

  // Why the card isn't faded instead: at 78% opacity over the page, the
  // timestamp and the badge both fall below 4.5:1.
  it.each([
    ["timestamp", "text-faint", 0],
    ['"Closed" badge', "status-closed", 0.1],
  ] as const)("would fail as the %s on a card faded to 78%%", (_, text, tint) => {
    const card = token("card");
    const ground = over(tint ? over(token(text), card, tint) : card, fill, 0.78);
    expect(contrast(over(token(text), fill, 0.78), ground)).toBeLessThan(4.5);
  });
});
