import { describe, expect, it } from "vitest";

import { contrast, over, token } from "@/test/support/contrast";

/*
 * Secondary text, hints, timestamps and placeholders all use one quiet grey.
 * Each surface below is one that such text sits on somewhere in the app, so the
 * grey must clear WCAG AA (4.5:1) against every one of them. An input field is
 * its 30% --input tint over whatever holds it, on the page or in a dialog.
 */

const SURFACES: [string, () => number[]][] = [
  ["the page", () => token("background")],
  ["a card", () => token("card")],
  ["a dialog, sheet or menu", () => token("popover")],
  ["a raised panel", () => token("surface-2")],
  ["a highlighted menu row", () => token("surface-3")],
  ["a hovered row", () => token("accent")],
  ["an input field on the page", () => over(token("input"), token("background"), 0.3)],
  ["an input field in a dialog", () => over(token("input"), token("popover"), 0.3)],
];

describe("the quiet grey", () => {
  it("is one colour, whichever token names it", () => {
    expect(token("text-faint")).toEqual(token("text-3"));
    expect(token("muted-foreground")).toEqual(token("text-3"));
  });

  it.each(SURFACES)("clears 4.5:1 on %s", (_, surface) => {
    expect(contrast(token("text-3"), surface())).toBeGreaterThanOrEqual(4.5);
  });
});
