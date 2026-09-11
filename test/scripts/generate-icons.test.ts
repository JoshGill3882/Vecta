import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, it, expect } from "vitest";

// Pure helpers — the module guards its own main(), so importing it here never
// reads or writes an image.
import {
  GROUND,
  ICO_SIZES,
  SVG_SIZE,
  buildIco,
  buildSvg,
  parseIco,
  squareTrimBox,
  toHex,
} from "../../scripts/generate-icons.mjs";

const icoPath = new URL("../../app/favicon.ico", import.meta.url);
const svgPath = new URL("../../app/icon.svg", import.meta.url);

/** An RGBA buffer with one opaque rectangle on a transparent field. */
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

// The regression guard. "The icon is legible" is a human judgement, but the
// property that caused #118 is not: the shipped mark was ~93% semi-transparent
// glow, so on a light tab strip almost nothing was left to read. Asserting the
// .ico is fully opaque would have caught that, and catches it coming back.
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
