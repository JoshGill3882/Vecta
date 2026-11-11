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
  furthestVisible,
  iconWindow,
  markCentre,
  parseIco,
  solidPieces,
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

describe("solidPieces", () => {
  it("finds each separate shape, largest first", () => {
    const data = canvas(10, 10, [0, 0, 3, 3]); // 16 pixels
    for (const [x, y] of [
      [8, 8],
      [9, 8],
    ])
      data[(y * 10 + x) * 4 + 3] = 255; // 2 pixels, apart from the first
    const pieces = solidPieces(data, 10, 10);
    expect(pieces.map((p) => p.pixels)).toEqual([16, 2]);
    expect(pieces[1]).toMatchObject({ left: 8, top: 8, right: 9, bottom: 8 });
  });

  it("ignores pixels at or below the solid threshold, so glow joins nothing", () => {
    const data = canvas(6, 6, [0, 0, 1, 1]);
    data[(5 * 6 + 5) * 4 + 3] = 100;
    expect(solidPieces(data, 6, 6, 128)).toHaveLength(1);
  });
});

describe("markCentre", () => {
  // A ring of shapes with a small piece off to one side, as the logo's squares
  // are: the centre must be the main shape's, not pulled towards the piece.
  it("centres on the main shapes and ignores small detached pieces", () => {
    const data = canvas(20, 20, [2, 2, 11, 11]); // 100 pixels, centred on (7, 7)
    data[(18 * 20 + 18) * 4 + 3] = 255; // one stray pixel in the far corner
    expect(markCentre(data, 20, 20)).toEqual({ x: 7, y: 7 });
  });

  it("throws when nothing in the source is solid", () => {
    expect(() => markCentre(new Uint8Array(4 * 4 * 4), 4, 4)).toThrow(/no solid shape/);
  });
});

describe("furthestVisible", () => {
  it("measures to the furthest pixel above the threshold, not to a box corner", () => {
    const data = new Uint8Array(9 * 9 * 4);
    data[(4 * 9 + 8) * 4 + 3] = 255; // one pixel at the middle of the right edge
    expect(furthestVisible(data, 9, 9, { x: 4.5, y: 4.5 })).toBeCloseTo(4, 5);
  });
});

describe("iconWindow", () => {
  const centre = { x: 245.5, y: 251.5 };

  it("sizes the window so the radius fills the given fraction of it", () => {
    const frame = iconWindow(centre, 200, SAFE_FRACTION);
    expect((2 * 200) / frame.size).toBeCloseTo(SAFE_FRACTION, 2);
  });

  // Within a pixel: the window's edges are whole pixels, so its centre can
  // round half a pixel away from a point that falls between two.
  it("centres the window on the given point", () => {
    const frame = iconWindow(centre, 200, SAFE_FRACTION);
    expect(Math.abs(frame.left + frame.size / 2 - centre.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame.top + frame.size / 2 - centre.y)).toBeLessThanOrEqual(1);
  });

  it("reaches past the source's edges when the window is larger, leaving the caller to pad", () => {
    expect(iconWindow(centre, 300, SAFE_FRACTION).left).toBeLessThan(0);
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
    let short = 0;
    for (let i = 0; i < size * size; i++) if (data[i * 4 + 3] !== 255) short++;
    expect(short).toBe(0);
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

  // Centred on the ring and check, which is what the eye lines up. The mark's
  // solid shapes are found by their distance from the ground, the opaque
  // equivalent of the alpha the generator centred them by.
  it.each(LAUNCHER_SIZES)("centres the mark at %ipx", async (size) => {
    const { data } = await pixelsOf(`public/icons/maskable-${size}.png`);
    const solidness = Buffer.alloc(data.length);
    for (let i = 0; i < size * size; i++) solidness[i * 4 + 3] = distanceFromGround(data, i);
    const centre = markCentre(solidness, size, size);
    expect(Math.abs(centre.x - size / 2)).toBeLessThan(size * 0.01);
    expect(Math.abs(centre.y - size / 2)).toBeLessThan(size * 0.01);
  });

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
    let short = 0;
    for (let i = 0; i < APPLE_SIZE * APPLE_SIZE; i++) if (data[i * 4 + 3] !== 255) short++;
    expect(short).toBe(0);
  });
});
