import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * WCAG contrast measured from the real tokens in app/globals.css, so a palette
 * change that breaks contrast fails a test instead of going unnoticed. Only
 * the dark palette is read, because it is the only one the app renders.
 */

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const dark = css.slice(css.indexOf(".dark {"));

/** Reads a colour token from the dark palette, following `var()` references.
 *
 * @param name The custom property, without its leading dashes.
 * @returns The colour as red, green and blue channels, 0-255.
 */
export function token(name: string): number[] {
  const match = dark.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6}|var\\(--([\\w-]+)\\))`));
  if (!match) throw new Error(`--${name} is neither a hex colour nor a var() in the .dark block`);
  if (match[2]) return token(match[2]);
  return [1, 3, 5].map((i) => parseInt(match[1].slice(i, i + 2), 16));
}

/** Composites a colour at an alpha over a solid background, as the browser does.
 *
 * @param fg The colour being laid over.
 * @param bg The solid colour beneath it.
 * @param alpha How opaque the top colour is, 0-1.
 * @returns The colour that reaches the screen.
 */
export function over(fg: number[], bg: number[], alpha: number): number[] {
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
export function contrast(a: number[], b: number[]): number {
  const [light, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (darker + 0.05);
}
