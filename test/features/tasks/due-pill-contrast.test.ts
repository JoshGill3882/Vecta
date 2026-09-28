import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

/*
 * Every due pill must meet WCAG AA (4.5:1) for its text, measured against what it
 * actually sits on: its own tint over the card. The ratios come from the real
 * tokens in app/globals.css, so a palette change that breaks contrast fails here
 * instead of going unnoticed.
 *
 * The pairs below mirror DUE_STYLES in due-pill.tsx. They are written out rather
 * than parsed from the class strings, which would test a Tailwind parser more than
 * the palette; a change to DUE_STYLES should change this table with it.
 */

const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");
const dark = css.slice(css.indexOf(".dark {"));

/** Reads a hex colour token from the dark palette, the only one the app renders.
 *
 * @param name The custom property, without its leading dashes.
 * @returns The colour as red, green and blue channels, 0-255.
 */
function token(name: string): number[] {
  const match = dark.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`--${name} is not a hex colour in the .dark block`);
  return [1, 3, 5].map((i) => parseInt(match[1].slice(i, i + 2), 16));
}

/** Composites a colour at an alpha over a solid background, as the browser does.
 *
 * @param fg The colour being laid over.
 * @param bg The solid colour beneath it.
 * @param alpha How opaque the top colour is, 0-1.
 * @returns The colour that reaches the screen.
 */
function over(fg: number[], bg: number[], alpha: number): number[] {
  return fg.map((channel, i) => channel * alpha + bg[i] * (1 - alpha));
}

/** WCAG 2.x relative luminance.
 *
 * @param rgb Red, green and blue channels, 0-255.
 * @returns Luminance, 0 (black) to 1 (white).
 */
function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio between two colours.
 *
 * @param a One colour.
 * @param b The other.
 * @returns The ratio, from 1 (none) to 21 (black on white).
 */
function contrast(a: number[], b: number[]): number {
  const [light, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (darker + 0.05);
}

const card = token("card");

describe("due pill contrast against the card", () => {
  it.each([
    // [state, text token, tint token, tint strength]
    ["overdue", "destructive", "destructive", 0.1],
    ["today", "brand-orange", "brand-orange", 0.15],
    ["soon", "text-2", "surface-2", 1],
    ["future", "text-3", null, 0],
    ["done", "text-2", null, 0],
  ] as const)("%s clears 4.5:1", (_, text, tint, strength) => {
    const ground = tint ? over(token(tint), card, strength) : card;
    expect(contrast(token(text), ground)).toBeGreaterThanOrEqual(4.5);
  });

  // Why the overdue tint is 10%: a stronger tint darkens the ground under the red
  // text until it no longer holds 4.5:1.
  it("would fail with a 15% overdue tint", () => {
    const ground = over(token("destructive"), card, 0.15);
    expect(contrast(token("destructive"), ground)).toBeLessThan(4.5);
  });
});
