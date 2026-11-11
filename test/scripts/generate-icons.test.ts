import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, it, expect } from "vitest";

// Pure helpers — the module guards its own main(), so importing it here never
// reads or writes an image.
import {
  APPLE_SIZE,
  GROUND,
  ICO_SIZES,
  LAUNCHER_SIZES,
  SAFE_FRACTION,
  SVG_SIZE,
  buildIco,
  buildSvg,
  contentBox,
  maskableWindow,
  parseIco,
  squareTrimBox,
  toHex,
} from "@/scripts/generate-icons.mjs";

const icoPath = new URL("../../app/favicon.ico", import.meta.url);
const svgPath = new URL("../../app/icon.svg", import.meta.url);

/** An RGBA buffer with one opaque rectangle on a transparent field.
 *
 * @param width Buffer width in pixels.
 * @param height Buffer height in pixels.
 * @param opaque The rectangle, as x0, y0, x1, y1 inclusive.
 * @returns The pixel data.
 */
function canvas(width: number, height: number, opaque: [number, number, number, number]) {
  const data = new Uint8Array(width * height * 4);
  const [x0, y0, x1, y1] = opaque;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) data[(y * width + x) * 4 + 3] = 255;
  }
  return data;
}

describe("squareTrimBox", () => {
  it("squares off a wider-than-tall mark and centres the box on it", () => {
    // Opaque from x 2..5, y 1..3 — 4 wide, 3 tall, so the square is 4.
    expect(squareTrimBox(canvas(8, 8, [2, 1, 5, 3]), 8, 8)).toEqual({ left: 2, top: 0, size: 4 });
  });

  it("squares off a taller-than-wide mark", () => {
    // Opaque from x 3..4, y 1..6 — 2 wide, 6 tall, so the square is 6 and its
    // left edge lands at round(3.5 - 3) = 1, keeping the mark centred.
    expect(squareTrimBox(canvas(8, 8, [3, 1, 4, 6]), 8, 8)).toEqual({ left: 1, top: 1, size: 6 });
  });

  it("clamps the box inside the canvas rather than letting it overflow", () => {
    const box = squareTrimBox(canvas(8, 8, [0, 3, 7, 4]), 8, 8);
    expect(box).toEqual({ left: 0, top: 0, size: 8 });
  });

  it("ignores pixels at or below the alpha threshold, so faint glow is not framed", () => {
    const data = canvas(8, 8, [3, 3, 4, 4]);
    data[0 * 4 + 3] = 5; // a corner pixel of near-nothing
    expect(squareTrimBox(data, 8, 8, 10)).toEqual({ left: 3, top: 3, size: 2 });
  });

  it("throws on a fully transparent source rather than returning a bogus box", () => {
    expect(() => squareTrimBox(new Uint8Array(8 * 8 * 4), 8, 8)).toThrow(/fully transparent/);
  });
});

describe("contentBox", () => {
  it("returns the mark's box as it lies, without squaring it", () => {
    expect(contentBox(canvas(8, 8, [2, 1, 5, 3]), 8, 8)).toEqual({
      left: 2,
      top: 1,
      width: 4,
      height: 3,
    });
  });

  it("throws on a fully transparent source", () => {
    expect(() => contentBox(new Uint8Array(4 * 4 * 4), 4, 4)).toThrow(/fully transparent/);
  });
});

describe("maskableWindow", () => {
  const box = { left: 30, top: 53, width: 414, height: 368 };
  const frame = maskableWindow(box);

  // The corners of the mark's box are its furthest points from the centre, so
  // the box's diagonal is what has to fit the safe circle.
  it("sizes the window so the mark's diagonal spans the safe circle", () => {
    const diagonal = Math.hypot(box.width, box.height);
    expect(diagonal / frame.size).toBeCloseTo(SAFE_FRACTION, 2);
  });

  it("centres the window on the mark, not on the source", () => {
    expect(frame.left + frame.size / 2).toBeCloseTo(box.left + box.width / 2, 0);
    expect(frame.top + frame.size / 2).toBeCloseTo(box.top + box.height / 2, 0);
  });

  it("reaches past a source edge when the mark is near one, leaving the caller to pad", () => {
    expect(frame.left).toBeLessThan(0);
    expect(frame.top).toBeLessThan(0);
  });
});

describe("buildIco / parseIco", () => {
  const pngs = [Buffer.from("first-payload"), Buffer.from("second")];
  const sizes = [16, 32];

  it("round-trips sizes and payloads", () => {
    const entries = parseIco(buildIco(pngs, sizes));

    expect(entries.map((e) => e.width)).toEqual(sizes);
    expect(entries.map((e) => e.height)).toEqual(sizes);
    expect(entries.map((e) => e.png.toString())).toEqual(pngs.map((p) => p.toString()));
  });

  it("declares 32-bit entries, which is what an RGBA payload is", () => {
    for (const entry of parseIco(buildIco(pngs, sizes))) expect(entry.bitCount).toBe(32);
  });

  it("rejects a container that is not an icon", () => {
    const cursor = buildIco(pngs, sizes);
    cursor.writeUInt16LE(2, 2); // type 2 = cursor
    expect(() => parseIco(cursor)).toThrow(/Not an .ico container/);
  });

  it("refuses mismatched inputs rather than writing a corrupt file", () => {
    expect(() => buildIco(pngs, [16])).toThrow(/differ in length/);
  });
});

describe("buildSvg", () => {
  const svg = buildSvg({ size: 96, radius: 18, ground: "#0a0c10", base64: "AAAA" });

  it("paints the ground by default and drops it under a dark theme", () => {
    expect(svg).toContain(".ground { fill: #0a0c10; }");
    expect(svg).toContain("@media (prefers-color-scheme: dark) { .ground { fill: none; } }");
  });

  it("inlines the raster, since a favicon SVG cannot fetch external resources", () => {
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
  });
});

describe("toHex", () => {
  it("pads each channel to two digits", () => {
    expect(toHex(GROUND)).toBe("#0a0c10");
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });
});

// The regression guard. "The icon is legible" is a human judgement; the
// property underneath it is not. A mark that is almost entirely semi-transparent
// glow leaves nothing to read on a light tab strip, so this asserts the .ico is
// fully opaque.
describe("the shipped app/favicon.ico", () => {
  const entries = parseIco(readFileSync(icoPath));

  it("carries the expected entry sizes", () => {
    expect(entries.map((e) => e.width)).toEqual(ICO_SIZES);
  });

  it("stores every entry as a PNG", () => {
    for (const entry of entries) {
      expect(entry.png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }
  });

  it("encodes every entry as RGBA, which Next's .ico decoder requires", () => {
    // Byte 25 is the IHDR colour type: 6 is truecolour-with-alpha.
    for (const entry of entries) expect(entry.png[25]).toBe(6);
  });

  it.each(ICO_SIZES)("is fully opaque at %ipx, with no glow left to composite", async (size) => {
    const entry = entries.find((e) => e.width === size)!;
    const { data, info } = await sharp(entry.png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    let opaque = 0;
    for (let i = 0; i < pixels; i++) if (data[i * 4 + 3] === 255) opaque++;

    expect(opaque).toBe(pixels);
  });
});

describe("the shipped app/icon.svg", () => {
  const svg = readFileSync(svgPath, "utf8");

  it("is theme-aware, which is the whole reason it exists alongside the .ico", () => {
    expect(svg).toContain("prefers-color-scheme: dark");
    expect(svg).toContain(toHex(GROUND));
  });

  it("inlines its raster rather than referencing a file the browser cannot fetch", () => {
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).not.toMatch(/href="(?!data:)/);
  });

  it("draws the raster at the size the viewBox declares", () => {
    expect(svg).toContain(`viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}"`);
    expect(svg).toContain(`width="${SVG_SIZE}" height="${SVG_SIZE}"`);
  });
});

/** Decodes a shipped PNG to raw RGBA.
 *
 * @param path The file, relative to the repository root.
 * @returns The pixels and their dimensions.
 */
async function pixelsOf(path: string) {
  const file = readFileSync(new URL(`../../${path}`, import.meta.url));
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** How far a pixel is from the ground, in its most different channel.
 *
 * @param data RGBA pixels.
 * @param i The pixel's index.
 * @returns The largest channel difference, 0 to 255.
 */
function distanceFromGround(data: Buffer, i: number) {
  return Math.max(
    Math.abs(data[i * 4] - GROUND.r),
    Math.abs(data[i * 4 + 1] - GROUND.g),
    Math.abs(data[i * 4 + 2] - GROUND.b)
  );
}

// A launcher crops a maskable icon to its own shape, and a transparent pixel
// there shows whatever is behind the icon. So these must be fully opaque, and
// everything visible must sit inside the circle every mask shape keeps.
describe("the shipped maskable icons", () => {
  /** Ground pixels can differ by this much before they count as visible. Glow
   * below the trim threshold is left outside the circle on purpose: at under 4%
   * alpha on the ground it shifts a channel by a few levels at most. */
  const VISIBLE = 12;

  it.each(LAUNCHER_SIZES)("is %ipx square and fully opaque", async (size) => {
    const { data, info } = await pixelsOf(`public/icons/maskable-${size}.png`);
    expect([info.width, info.height]).toEqual([size, size]);
    for (let i = 0; i < size * size; i++) expect(data[i * 4 + 3]).toBe(255);
  });

  it.each(LAUNCHER_SIZES)(
    "keeps everything visible inside the safe circle at %ipx",
    async (size) => {
      const { data } = await pixelsOf(`public/icons/maskable-${size}.png`);
      const radius = (size * SAFE_FRACTION) / 2;
      let outside = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const fromCentre = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
          if (fromCentre > radius + 1 && distanceFromGround(data, y * size + x) > VISIBLE)
            outside++;
        }
      }
      expect(outside).toBe(0);
    }
  );

  // The guard above passes trivially for an icon that is all ground, so this
  // checks the mark is actually there.
  it.each(LAUNCHER_SIZES)("carries the mark at %ipx", async (size) => {
    const { data } = await pixelsOf(`public/icons/maskable-${size}.png`);
    let visible = 0;
    for (let i = 0; i < size * size; i++) if (distanceFromGround(data, i) > VISIBLE) visible++;
    expect(visible / (size * size)).toBeGreaterThan(0.1);
  });
});

describe("the shipped any-purpose icons", () => {
  // These are for surfaces that do not mask, and an opaque tile there would show
  // as a dark square where the bare mark was wanted.
  it.each(LAUNCHER_SIZES)("is %ipx square and keeps its transparency", async (size) => {
    const { data, info } = await pixelsOf(`public/icons/icon-${size}.png`);
    expect([info.width, info.height]).toEqual([size, size]);
    let transparent = 0;
    for (let i = 0; i < size * size; i++) if (data[i * 4 + 3] < 255) transparent++;
    expect(transparent).toBeGreaterThan(0);
  });
});

describe("the shipped app/apple-icon.png", () => {
  // iOS fills any transparency in a home-screen icon with black, so the ground
  // is painted in rather than left to it.
  it(`is ${APPLE_SIZE}px square and fully opaque`, async () => {
    const { data, info } = await pixelsOf("app/apple-icon.png");
    expect([info.width, info.height]).toEqual([APPLE_SIZE, APPLE_SIZE]);
    for (let i = 0; i < APPLE_SIZE * APPLE_SIZE; i++) expect(data[i * 4 + 3]).toBe(255);
  });
});
