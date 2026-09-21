// Regenerates the browser icons from public/logo.png.
//
// Two files come out of here, and they are layers rather than alternatives:
//
//   app/favicon.ico  the floor. Flattened onto the app's own dark ground, so it
//                    is legible on a light tab strip and a dark one alike. Every
//                    browser gets this.
//   app/icon.svg     the enhancement. A `prefers-color-scheme` query toggles that
//                    ground, so browsers with SVG favicon support show the mark
//                    floating in dark themes, as it was drawn.
//
// Both exist because the source mark is drawn as ambient light against #0a0c10:
// the overwhelming majority of it is soft bloom and only a few percent is solid,
// so composited onto a light ground there is almost no mark left to read — and
// the white check, the most identifiable part, disappears entirely.
//
// public/logo.png is NOT touched. It is used as an in-app <Image> by the top bar
// and the login screen, where it sits on the background it was drawn for.
//
// Run: `npm run icons:generate` — then commit whatever changed.

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** The app's background (`--background`), and the ground painted behind the mark. */
export const GROUND = { r: 0x0a, g: 0x0c, b: 0x10 };

/** Entry sizes in the .ico, matching the file this replaced. */
export const ICO_SIZES = [16, 32, 48];

/** Resolution of the raster embedded in the SVG. 96px keeps it under ~9KB. */
export const SVG_SIZE = 96;

/** Corner radius of the SVG's ground tile, ~19% — a conventional app-icon curve. */
export const SVG_RADIUS = 18;

/**
 * Alpha above which a pixel counts as part of the mark for trimming purposes.
 * Deliberately low: the intent is to drop dead margin, not to crop into the glow.
 */
export const TRIM_THRESHOLD = 10;

/**
 * Bounding box of everything above `threshold` alpha, squared off and re-centred.
 *
 * Derived rather than hardcoded so the script still frames correctly if the logo
 * is ever replaced with art of a different shape. The result is square because a
 * favicon is, and clamped so a wide mark cannot push the box off the canvas.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @param {number} [threshold]
 * @returns {{ left: number, top: number, size: number }}
 */
export function squareTrimBox(rgba, width, height, threshold = TRIM_THRESHOLD) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < 0) throw new Error("Source image is fully transparent — nothing to trim to.");

  const size = Math.min(Math.max(x1 - x0 + 1, y1 - y0 + 1), Math.min(width, height));
  const left = Math.max(0, Math.min(width - size, Math.round((x0 + x1) / 2 - size / 2)));
  const top = Math.max(0, Math.min(height - size, Math.round((y0 + y1) / 2 - size / 2)));

  return { left, top, size };
}

/**
 * Assemble PNG buffers into an .ico container.
 *
 * The format is a 6-byte ICONDIR, one 16-byte ICONDIRENTRY per image, then the
 * payloads. Entries are PNG rather than BMP, which browsers accept and which
 * matches the file this replaced.
 *
 * @param {Buffer[]} pngs - One PNG per size, in the same order as `sizes`.
 * @param {number[]} sizes - Square edge lengths, 1-256.
 * @returns {Buffer}
 */
export function buildIco(pngs, sizes) {
  if (pngs.length !== sizes.length) throw new Error("buildIco: pngs and sizes differ in length");

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((size, i) => {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size; // width; 0 encodes 256
    entry[1] = size === 256 ? 0 : size; // height
    entry[2] = 0; // palette size; 0 for truecolour
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(pngs[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs]);
}

/**
 * Read back an .ico container. Used by the icon tests, and handy for checking a
 * generated file without reaching for another tool.
 *
 * @param {Buffer} ico
 * @returns {{ width: number, height: number, bitCount: number, png: Buffer }[]}
 */
export function parseIco(ico) {
  if (ico.readUInt16LE(2) !== 1) throw new Error("Not an .ico container (type != 1)");

  return Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const o = 6 + i * 16;
    const length = ico.readUInt32LE(o + 8);
    const offset = ico.readUInt32LE(o + 12);
    return {
      width: ico[o] || 256,
      height: ico[o + 1] || 256,
      bitCount: ico.readUInt16LE(o + 6),
      png: ico.subarray(offset, offset + length),
    };
  });
}

/**
 * The theme-aware SVG favicon.
 *
 * The mark is embedded as a raster rather than redrawn as vector: the bloom is a
 * raster effect that does not translate, and a favicon SVG cannot fetch external
 * resources, so it cannot simply reference logo.png.
 *
 * @param {{ size: number, radius: number, ground: string, base64: string }} opts
 * @returns {string}
 */
export function buildSvg({ size, radius, ground, base64 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <!--
    GENERATED by scripts/generate-icons.mjs from public/logo.png. Do not hand-edit;
    run \`npm run icons:generate\` instead.

    A light-themed tab gets the app's own ground painted behind the mark, because
    the mark is mostly soft bloom and has almost nothing solid left to read once
    composited onto a light surface. A dark theme needs no ground, so the mark
    floats as it was drawn.

    The browser rasterises this once and caches the bitmap, so the query below is
    only evaluated at that point — src/components/shell/favicon-theme-sync.tsx is
    what makes a live theme change take effect without a hard refresh.
  -->
  <style>
    .ground { fill: ${ground}; }
    @media (prefers-color-scheme: dark) { .ground { fill: none; } }
  </style>
  <rect class="ground" width="${size}" height="${size}" rx="${radius}"/>
  <image href="data:image/png;base64,${base64}" width="${size}" height="${size}"/>
</svg>
`;
}

/** `#rrggbb` for a sharp-style colour object. */
export function toHex({ r, g, b }) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const SOURCE = "public/logo.png";
  const source = readFileSync(SOURCE);
  const { width, height } = await sharp(source).metadata();
  const { data } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const box = squareTrimBox(data, width, height);
  const crop = { left: box.left, top: box.top, width: box.size, height: box.size };
  const pct = Math.round((100 * box.size) / width);
  console.log(`${SOURCE}: ${width}x${height} -> trimmed to ${box.size}px square (${pct}%)`);

  // --- app/favicon.ico -------------------------------------------------------
  // Flattening composites onto the ground and drops the alpha channel; the alpha
  // is then put back fully opaque, because Next's .ico decoder rejects any entry
  // whose PNG is not RGBA. Nothing is left semi-transparent either way.
  const pngs = [];
  for (const size of ICO_SIZES) {
    pngs.push(
      await sharp(source)
        .extract(crop)
        .resize(size, size)
        .flatten({ background: GROUND })
        .ensureAlpha(1)
        .png({ compressionLevel: 9 })
        .toBuffer()
    );
  }
  const ico = buildIco(pngs, ICO_SIZES);
  writeFileSync("app/favicon.ico", ico);
  console.log(`app/favicon.ico: ${ICO_SIZES.join("/")} at ${ico.length} B`);

  // --- app/icon.svg ----------------------------------------------------------
  // Palette-quantised: full RGBA at this size is roughly three times larger for
  // no visible difference on the gradients.
  const raster = await sharp(source)
    .extract(crop)
    .resize(SVG_SIZE, SVG_SIZE)
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  const svg = buildSvg({
    size: SVG_SIZE,
    radius: SVG_RADIUS,
    ground: toHex(GROUND),
    base64: raster.toString("base64"),
  });
  writeFileSync("app/icon.svg", svg);
  console.log(`app/icon.svg: ${SVG_SIZE}px raster at ${svg.length} B`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
