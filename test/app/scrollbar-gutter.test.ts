import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwind from "@tailwindcss/postcss";
import postcss, { type AtRule, type Declaration, type Root, type Rule } from "postcss";
import { beforeAll, describe, expect, it } from "vitest";

const CSS_PATH = fileURLToPath(new URL("../../app/globals.css", import.meta.url));
const REPO = fileURLToPath(new URL("../..", import.meta.url));

/** A declaration found in the compiled stylesheet, with where it ended up. */
type Found = { selector: string; layer: string | null; value: string; important: boolean };

/** Compiles app/globals.css through Tailwind, as the build does.
 *
 * Checking the compiled output rather than the source proves each rule
 * survives Tailwind, and shows which cascade layer it lands in.
 *
 * @returns The compiled stylesheet's root node.
 */
async function compile() {
  const result = await postcss([tailwind({ base: REPO })]).process(readFileSync(CSS_PATH, "utf8"), {
    from: CSS_PATH,
  });
  return result.root;
}

/** Collects every declaration of `prop` in the compiled stylesheet.
 *
 * @param root The compiled stylesheet.
 * @param prop The property to look for.
 * @returns Each declaration's selector, layer, value and importance.
 */
function declarationsOf(root: Root, prop: string): Found[] {
  const found: Found[] = [];
  root.walkDecls(prop, (decl: Declaration) => {
    const rule = decl.parent as Rule;
    const parent = rule.parent;
    const layer =
      parent?.type === "atrule" && (parent as AtRule).name === "layer"
        ? (parent as AtRule).params
        : null;
    found.push({
      selector: rule.selector,
      layer,
      value: decl.value,
      important: decl.important ?? false,
    });
  });
  return found;
}

/* A layout shift can't be measured here: jsdom does no layout and draws no
   scrollbars. These cases pin the two rules that prevent it, so removing or
   weakening either fails a test rather than only a manual check. */
describe("the page's scrollbar gutter", () => {
  let root: Root;

  beforeAll(async () => {
    root = await compile();
  });

  it("is reserved on the root element whether or not the page scrolls", () => {
    expect(declarationsOf(root, "scrollbar-gutter")).toContainEqual(
      expect.objectContaining({ selector: "html", value: "stable" })
    );
  });

  it("is not compensated for a second time while a dialog or menu locks scrolling", () => {
    const margins = declarationsOf(root, "margin-right").filter((found) =>
      found.selector.includes("[data-scroll-locked]")
    );
    expect(margins).toEqual([
      // Unlayered, !important, and one selector more specific than the lock's
      // own `body[data-scroll-locked]`, so it wins whichever loads last.
      { selector: "html body[data-scroll-locked]", layer: null, value: "0", important: true },
    ]);
  });
});
