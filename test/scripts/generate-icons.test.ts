import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, it, expect } from "vitest";

// Pure helpers — the module guards its own main(), so importing it here never
// reads or writes an image.
import {
  ANY_FRACTION,
  APPLE_FRACTION,
  APPLE_SIZE,
  GROUND,
  ICO_SIZES,
  LAUNCHER_SIZES,
  SAFE_FRACTION,
  TILE_RADIUS,
  buildIco,
  framedSvg,
  furthestSolid,
  iconWindow,
  markCentre,
  parseIco,
  solidPieces,
  svgParts,
  toHex,
} from "@/scripts/generate-icons.mjs";

/** iOS's home-screen corner radius, as a fraction of the icon's width. */
const IOS_CORNER = 0.224;

/** How far a pixel may stray from the ground and still count as ground.
 *
 * Covers the anti-aliasing at the mark's edges, which blends a few levels of
 * colour into the pixels beside it.
 */
const VISIBLE = 12;

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

/** Decodes a shipped PNG to raw RGBA.
 *
 * @param file The PNG's bytes.
 * @returns The pixels and their dimensions.
 */
function pixels(file: Buffer) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** Reads a shipped file.
 *
 * @param path The file, relative to the repository root.
 * @returns Its bytes.
 */
function shipped(path: string): Buffer {
  return readFileSync(new URL(`../../${path}`, import.meta.url));
}

/** How far a pixel is from the ground, in its most different channel, scaled
 * by its opacity so a transparent pixel never counts.
 *
 * @param data RGBA pixels.
 * @param i The pixel's index.
 * @returns 0 for ground or nothing, up to 255.
 */
function markness(data: Buffer, i: number): number {
  const far = Math.max(
    Math.abs(data[i * 4] - GROUND.r),
    Math.abs(data[i * 4 + 1] - GROUND.g),
    Math.abs(data[i * 4 + 2] - GROUND.b)
  );
  return Math.round((far * data[i * 4 + 3]) / 255);
}

/** How far a pixel's centre lies beyond the curve of a rounded square the size of the icon.
 *
 * Only the corners curve, so a pixel anywhere else is never beyond it.
 *
 * @param x The pixel's column.
 * @param y The pixel's row.
 * @param size The icon's width.
 * @param radius The corner radius, as a fraction of the width.
 * @returns Pixels beyond the curve; negative inside it.
 */
function beyondCurve(x: number, y: number, size: number, radius: number): number {
  const r = radius * size;
  const px = x + 0.5;
  const py = y + 0.5;
  const cx = Math.min(Math.max(px, r), size - r);
  const cy = Math.min(Math.max(py, r), size - r);
  return Math.hypot(px - cx, py - cy) - r;
}

/** The point the mark is centred on in a shipped icon, found as the generator finds it.
 *
 * @param data RGBA pixels.
 * @param size The icon's width.
 * @returns The centre, in pixels.
 */
function centreOf(data: Buffer, size: number) {
  const solidness = Buffer.alloc(data.length);
  for (let i = 0; i < size * size; i++) solidness[i * 4 + 3] = markness(data, i);
  return markCentre(solidness, size, size);
}

/** The mark's reach in a shipped icon, as a fraction of its width.
 *
 * @param data RGBA pixels.
 * @param size The icon's width.
 * @returns Twice the furthest solid pixel's distance from the centre, over the width.
 */
function reachOf(data: Buffer, size: number): number {
  const solidness = Buffer.alloc(data.length);
  for (let i = 0; i < size * size; i++) solidness[i * 4 + 3] = markness(data, i);
  return (2 * furthestSolid(solidness, size, size, centreOf(data, size))) / size;
}

describe("svgParts", () => {
  it("reads the square viewBox and the drawing inside the root element", () => {
    const parts = svgParts('<svg viewBox="10 20 30 30"><!-- note --><rect/></svg>');
    expect(parts).toEqual({ viewBox: { x: 10, y: 20, size: 30 }, body: "<rect/>" });
  });

  it("refuses a mark with no viewBox, which nothing could be framed from", () => {
    expect(() => svgParts("<svg><rect/></svg>")).toThrow(/no viewBox/);
  });

  it("refuses a viewBox that is not square", () => {
    expect(() => svgParts('<svg viewBox="0 0 30 20"><rect/></svg>')).toThrow(/square/);
  });
});

describe("framedSvg", () => {
  const frame = { left: 5, top: 6, size: 100 };

  it("shows exactly the frame, at the size asked for", () => {
    const svg = framedSvg({ body: "<rect/>", frame, size: 48 });
    expect(svg).toContain('viewBox="5 6 100 100" width="48" height="48"');
    expect(svg).toContain("<rect/>");
  });

  it("puts the ground under the mark, with its corners rounded by the given fraction", () => {
    const svg = framedSvg({ body: "<path/>", frame, radius: 0.25 });
    expect(svg).toContain(`rx="25" fill="${toHex(GROUND)}"`);
    expect(svg.indexOf("rx=")).toBeLessThan(svg.indexOf("<path/>"));
  });

  it("leaves the ground out when there is no radius", () => {
    expect(framedSvg({ body: "<path/>", frame })).not.toContain("<rect");
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

  it("ignores pixels at or below the solid threshold, such as anti-aliased edges", () => {
    const data = canvas(6, 6, [0, 0, 1, 1]);
    data[(5 * 6 + 5) * 4 + 3] = 100;
    expect(solidPieces(data, 6, 6, 128)).toHaveLength(1);
  });
});

describe("markCentre", () => {
  // A main shape with a small piece off to one side, as the mark's squares
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

describe("furthestSolid", () => {
  it("measures to the furthest solid pixel, not to a box corner", () => {
    const data = new Uint8Array(9 * 9 * 4);
    data[(4 * 9 + 8) * 4 + 3] = 255; // one pixel at the middle of the right edge
    expect(furthestSolid(data, 9, 9, { x: 4.5, y: 4.5 })).toBeCloseTo(4, 5);
  });
});

describe("iconWindow", () => {
  const centre = { x: 245.5, y: 251.5 };

  it("sizes the window so the reach spans the given fraction of it", () => {
    const frame = iconWindow(centre, 200, SAFE_FRACTION);
    expect((2 * 200) / frame.size).toBeCloseTo(SAFE_FRACTION, 10);
  });

  it("centres the window on the given point", () => {
    const frame = iconWindow(centre, 200, ANY_FRACTION);
    expect(frame.left + frame.size / 2).toBeCloseTo(centre.x, 10);
    expect(frame.top + frame.size / 2).toBeCloseTo(centre.y, 10);
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

describe("toHex", () => {
  it("pads each channel to two digits", () => {
    expect(toHex(GROUND)).toBe("#0a0c10");
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });
});

// The logo is served as-is to the login screen before anyone signs in, and
// next/image does not sanitise SVGs, so it must stay plain drawing.
describe("the shipped public/logo.svg", () => {
  const svg = shipped("public/logo.svg").toString("utf8");

  it("has a square viewBox for the generator to frame from", () => {
    expect(() => svgParts(svg)).not.toThrow();
  });

  it("holds no scripts, event handlers or external references", () => {
    expect(svg).not.toMatch(/<script|\son[a-z]+=|href="(?!#)/i);
  });
});

/** The checks every rounded tile must pass, at each of its sizes.
 *
 * @param name The icon, as the suite names it.
 * @param sizes The sizes it ships at.
 * @param load Reads the PNG at one size.
 */
function describeTile(name: string, sizes: number[], load: (size: number) => Promise<Buffer>) {
  describe(name, () => {
    // A pixel either side of the curve is anti-aliased, so each check leaves
    // that one-pixel band out.
    it.each(sizes)("is opaque inside the tile's curve at %ipx", async (size) => {
      const { data, info } = await pixels(await load(size));
      expect([info.width, info.height]).toEqual([size, size]);
      let short = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (beyondCurve(x, y, size, TILE_RADIUS) < -1 && data[(y * size + x) * 4 + 3] < 255)
            short++;
        }
      }
      expect(short).toBe(0);
    });

    // Nothing drawn outside the curve proves the mark, squares included, stays
    // inside it rather than spilling onto whatever is behind the icon.
    it.each(sizes)("is transparent outside the tile's curve at %ipx", async (size) => {
      const { data } = await pixels(await load(size));
      let drawn = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (beyondCurve(x, y, size, TILE_RADIUS) > 1 && data[(y * size + x) * 4 + 3] > 0) drawn++;
        }
      }
      expect(drawn).toBe(0);
    });

    it.each(sizes.filter((size) => size >= 48))("centres the mark at %ipx", async (size) => {
      const { data } = await pixels(await load(size));
      const centre = centreOf(data, size);
      expect(Math.abs(centre.x - size / 2)).toBeLessThan(size * 0.01);
      expect(Math.abs(centre.y - size / 2)).toBeLessThan(size * 0.01);
    });
  });
}

describeTile("the shipped desktop icons", LAUNCHER_SIZES, async (size) =>
  shipped(`public/icons/icon-${size}.png`)
);

describeTile("the shipped app/favicon.ico", ICO_SIZES, async (size) => {
  const entry = parseIco(shipped("app/favicon.ico")).find((e) => e.width === size);
  if (!entry) throw new Error(`favicon.ico has no ${size}px entry`);
  return Buffer.from(entry.png);
});

describe("the shipped desktop icons' framing", () => {
  it.each(LAUNCHER_SIZES)("frames the mark as closely as the tile allows at %ipx", async (size) => {
    const { data } = await pixels(shipped(`public/icons/icon-${size}.png`));
    expect(reachOf(data, size)).toBeCloseTo(ANY_FRACTION, 1);
  });
});

describe("the shipped app/favicon.ico's container", () => {
  const entries = parseIco(shipped("app/favicon.ico"));

  it("carries the expected entry sizes", () => {
    expect(entries.map((e) => e.width)).toEqual(ICO_SIZES);
  });

  it("encodes every entry as an RGBA PNG, which Next's .ico decoder requires", () => {
    for (const entry of entries) {
      expect(entry.png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      // Byte 25 is the IHDR colour type: 6 is truecolour-with-alpha.
      expect(entry.png[25]).toBe(6);
    }
  });
});

describe("the shipped app/icon.svg", () => {
  const svg = shipped("app/icon.svg").toString("utf8");

  it("draws the mark as vectors, with nothing to fetch", () => {
    expect(svg).not.toContain("<image");
    expect(svg).not.toMatch(/href="(?!#)/);
  });

  it("keeps its dark ground whatever the browser's theme", () => {
    expect(svg).toContain(`fill="${toHex(GROUND)}"`);
    expect(svg).not.toContain("prefers-color-scheme");
  });
});

/** The checks every full-bleed icon must pass.
 *
 * @param name The icon, as the suite names it.
 * @param sizes The sizes it ships at.
 * @param load Reads the PNG at one size.
 * @param keep Where the mark must stay.
 * @param keep.describe That area in words, for the test's name.
 * @param keep.outside Whether a pixel lies outside it.
 */
function describeFullBleed(
  name: string,
  sizes: number[],
  load: (size: number) => Buffer,
  keep: { describe: string; outside: (x: number, y: number, size: number) => boolean }
) {
  describe(name, () => {
    // A transparent pixel shows whatever is behind the icon, and iOS fills one
    // with black, so the ground is painted in edge to edge.
    it.each(sizes)("is %ipx square and fully opaque", async (size) => {
      const { data, info } = await pixels(load(size));
      expect([info.width, info.height]).toEqual([size, size]);
      let short = 0;
      for (let i = 0; i < size * size; i++) if (data[i * 4 + 3] !== 255) short++;
      expect(short).toBe(0);
    });

    it.each(sizes)(`keeps the mark ${keep.describe} at %ipx`, async (size) => {
      const { data } = await pixels(load(size));
      let outside = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (keep.outside(x, y, size) && markness(data, y * size + x) > VISIBLE) outside++;
        }
      }
      expect(outside).toBe(0);
    });

    it.each(sizes)("centres the mark at %ipx", async (size) => {
      const { data } = await pixels(load(size));
      const centre = centreOf(data, size);
      expect(Math.abs(centre.x - size / 2)).toBeLessThan(size * 0.01);
      expect(Math.abs(centre.y - size / 2)).toBeLessThan(size * 0.01);
    });
  });
}

describeFullBleed(
  "the shipped phone icons",
  LAUNCHER_SIZES,
  (size) => shipped(`public/icons/maskable-${size}.png`),
  {
    describe: "inside the safe circle",
    outside: (x, y, size) =>
      Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > (size * SAFE_FRACTION) / 2 + 1,
  }
);

describeFullBleed(
  "the shipped app/apple-icon.png",
  [APPLE_SIZE],
  () => shipped("app/apple-icon.png"),
  {
    describe: "inside iOS's corner curve",
    outside: (x, y, size) => beyondCurve(x, y, size, IOS_CORNER) > 0,
  }
);

describe("the shipped launcher icons' framing", () => {
  it.each(LAUNCHER_SIZES)("fills the phone icon's safe circle at %ipx", async (size) => {
    const { data } = await pixels(shipped(`public/icons/maskable-${size}.png`));
    expect(reachOf(data, size)).toBeCloseTo(SAFE_FRACTION, 1);
  });

  it("frames the iPhone icon closer than the phone's safe circle", async () => {
    const { data } = await pixels(shipped("app/apple-icon.png"));
    expect(reachOf(data, APPLE_SIZE)).toBeCloseTo(APPLE_FRACTION, 1);
  });
});
