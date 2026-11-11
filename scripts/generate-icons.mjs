// Regenerates the browser and launcher icons from public/logo.png.
//
// The two tab icons are layers rather than alternatives:
//
//   app/favicon.ico  the floor. Flattened onto the app's own dark ground, so it
//                    is legible on a light tab strip and a dark one alike. Every
//                    browser gets this.
//   app/icon.svg     the enhancement. A `prefers-color-scheme` query toggles that
//                    ground, so browsers with SVG favicon support show the mark
//                    floating in dark themes, as it was drawn.
//
// The launcher icons are what an installed app shows on a home screen, and are
// listed by app/manifest.ts:
//
//   public/icons/maskable-{192,512}.png  opaque and full-bleed, for launchers
//                    that crop to their own mask shape. The mark is kept inside
//                    the centred safe circle every mask shape contains.
//   public/icons/icon-{192,512}.png      the bare mark on transparency, for
//                    surfaces that do not mask and would otherwise show a tile.
//   app/apple-icon.png                   iOS's home-screen icon, opaque on the
//                    dark ground with the maskable framing. Next links it itself.
//
// All three are centred on the ring and check rather than on the whole mark:
// the small squares beside the ring, and the glow's uneven spread, would
// otherwise pull the centre off the shape the eye lines up.
//
// They live in public/ rather than as app/icon*.png files because Next turns
// every icon file under app/ into a <link rel="icon"> tag, and these are for
// the manifest, not the tab.
//
// All of them exist because the source mark is drawn as ambient light against #0a0c10:
// the overwhelming majority of it is soft bloom and only a few percent is solid,
// so composited onto a light ground there is almost no mark left to read — and
// the white check, the most identifiable part, disappears entirely.
//
// public/logo.png is NOT touched. It is used as an in-app <Image> by the top bar
// and the login screen, where it sits on the background it was drawn for.
//
// Run: `npm run icons:generate` — then commit whatever changed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** The app's background (`--background`), and the ground painted behind the mark. */
export const GROUND = { r: 0x0a, g: 0x0c, b: 0x10 };

/** Entry sizes in the .ico, matching the file this replaced. */
export const ICO_SIZES = [16, 32, 48];

/** Resolution of the raster embedded in the SVG. 96px keeps it under ~9KB. */
export const SVG_SIZE = 96;

/** Corner radius of the SVG's ground tile, ~19% — a conventional app-icon curve. */
export const SVG_RADIUS = 18;

/** Square sizes of the launcher icons the manifest lists. */
export const LAUNCHER_SIZES = [192, 512];

/** Size iOS asks for its home-screen icon. */
export const APPLE_SIZE = 180;

/** Diameter of the maskable safe circle, as a fraction of the icon's width.
 *
 * A launcher may crop a maskable icon to any shape, from a circle to a
 * squircle, and the circle this wide is the area every one of them keeps.
 */
export const SAFE_FRACTION = 0.8;

/** Alpha above which a pixel counts as solid when finding the mark's shapes.
 *
 * High enough to leave the glow out, so the shapes found are the ones drawn.
 */
export const SOLID_THRESHOLD = 128;

/** How large a solid shape must be, as a fraction of the largest, to centre on.
 *
 * Small pieces detached from the main shape, such as the squares beside the
 * ring, are part of the mark but not what the eye centres it by.
 */
export const MAIN_PIECE_FRACTION = 0.1;

/** Alpha above which a pixel counts as part of the mark for trimming purposes.
 *
 * Deliberately low: the intent is to drop dead margin, not to crop into the
 * glow.
 */
export const TRIM_THRESHOLD = 10;

/** Bounding box of everything above `threshold` alpha, as it lies.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @param {number} [threshold]
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function contentBox(rgba, width, height, threshold = TRIM_THRESHOLD) {
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
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Bounding box of everything above `threshold` alpha, squared off and re-centred.
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
  const box = contentBox(rgba, width, height, threshold);
  const x1 = box.left + box.width - 1;
  const y1 = box.top + box.height - 1;

  const size = Math.min(Math.max(box.width, box.height), Math.min(width, height));
  const left = Math.max(0, Math.min(width - size, Math.round((box.left + x1) / 2 - size / 2)));
  const top = Math.max(0, Math.min(height - size, Math.round((box.top + y1) / 2 - size / 2)));

  return { left, top, size };
}

/** The mark's separate solid shapes, found by flood fill.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @param {number} [threshold]
 * @returns {{ pixels: number, left: number, top: number, right: number, bottom: number }[]}
 *   One entry per shape, largest first, with inclusive pixel bounds.
 */
export function solidPieces(rgba, width, height, threshold = SOLID_THRESHOLD) {
  const solid = (i) => rgba[i * 4 + 3] > threshold;
  const seen = new Uint8Array(width * height);
  const pieces = [];

  for (let start = 0; start < width * height; start++) {
    if (!solid(start) || seen[start]) continue;
    const piece = { pixels: 0, left: width, top: height, right: -1, bottom: -1 };
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % width;
      const y = Math.floor(i / width);
      piece.pixels++;
      piece.left = Math.min(piece.left, x);
      piece.right = Math.max(piece.right, x);
      piece.top = Math.min(piece.top, y);
      piece.bottom = Math.max(piece.bottom, y);

      const neighbours = [];
      if (x > 0) neighbours.push(i - 1);
      if (x < width - 1) neighbours.push(i + 1);
      if (y > 0) neighbours.push(i - width);
      if (y < height - 1) neighbours.push(i + width);
      for (const n of neighbours) {
        if (solid(n) && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    pieces.push(piece);
  }

  return pieces.sort((a, b) => b.pixels - a.pixels);
}

/** The point the eye centres the mark by, in source pixels.
 *
 * The middle of the box around the mark's main shapes, ignoring pieces too
 * small to count as one. Derived rather than measured once and hardcoded, so it
 * still holds if the logo is replaced.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number }}
 */
export function markCentre(rgba, width, height) {
  const pieces = solidPieces(rgba, width, height);
  if (pieces.length === 0) throw new Error("Source image has no solid shape to centre on.");

  const main = pieces.filter((p) => p.pixels >= pieces[0].pixels * MAIN_PIECE_FRACTION);
  const left = Math.min(...main.map((p) => p.left));
  const right = Math.max(...main.map((p) => p.right)) + 1;
  const top = Math.min(...main.map((p) => p.top));
  const bottom = Math.max(...main.map((p) => p.bottom)) + 1;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** The distance from `centre` to the furthest pixel that is part of the mark.
 *
 * Measured over the pixels themselves rather than a bounding box: the mark is
 * round, so the corners of its box are empty, and a box would shrink the mark
 * to keep nothing inside the safe circle.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number }} centre
 * @param {number} [threshold]
 * @returns {number}
 */
export function furthestVisible(rgba, width, height, centre, threshold = TRIM_THRESHOLD) {
  let furthest = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > threshold) {
        furthest = Math.max(furthest, Math.hypot(x + 0.5 - centre.x, y + 0.5 - centre.y));
      }
    }
  }
  return furthest;
}

/** The square of the source that becomes an icon, in source pixels.
 *
 * Centred on `centre`, and sized so a circle of `radius` fills `fraction` of
 * the icon's width: 0.8 keeps the mark inside a maskable icon's safe circle,
 * 1 lets it fill an icon that is not masked. The window can reach past the
 * source's edges, starting at a negative offset; the caller pads.
 *
 * @param {{ x: number, y: number }} centre
 * @param {number} radius
 * @param {number} fraction
 * @returns {{ left: number, top: number, size: number }}
 */
export function iconWindow(centre, radius, fraction) {
  const size = Math.round((2 * radius) / fraction);
  return {
    left: Math.round(centre.x - size / 2),
    top: Math.round(centre.y - size / 2),
    size,
  };
}

/** Assemble PNG buffers into an .ico container.
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

/** Read back an .ico container.
 *
 * Used by the icon tests, and handy for checking a generated file without
 * reaching for another tool.
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

/** The theme-aware SVG favicon.
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

  // --- launcher icons --------------------------------------------------------
  const centre = markCentre(data, width, height);
  const radius = furthestVisible(data, width, height, centre);
  console.log(`mark centred at (${centre.x}, ${centre.y}), reaching ${Math.round(radius)}px`);

  /** The source cut to `frame`, padded with transparency where the frame
   * reaches past its edges. */
  const framed = async (frame) => {
    const pad = {
      left: Math.max(0, -frame.left),
      top: Math.max(0, -frame.top),
      right: Math.max(0, frame.left + frame.size - width),
      bottom: Math.max(0, frame.top + frame.size - height),
    };
    const padded = await sharp(source)
      .extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return sharp(padded).extract({
      left: frame.left + pad.left,
      top: frame.top + pad.top,
      width: frame.size,
      height: frame.size,
    });
  };

  const maskableFrame = iconWindow(centre, radius, SAFE_FRACTION);
  const anyFrame = iconWindow(centre, radius, 1);

  // Flattening paints the ground under everything, padding included, so no
  // pixel is left short of opaque, which is what a launcher's mask needs.
  const maskable = async (size) =>
    (await framed(maskableFrame))
      .resize(size, size)
      .flatten({ background: GROUND })
      .png({ compressionLevel: 9 })
      .toBuffer();
  const bare = async (size) =>
    (await framed(anyFrame)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

  mkdirSync("public/icons", { recursive: true });
  for (const size of LAUNCHER_SIZES) {
    const maskablePath = `public/icons/maskable-${size}.png`;
    writeFileSync(maskablePath, await maskable(size));
    const anyPath = `public/icons/icon-${size}.png`;
    writeFileSync(anyPath, await bare(size));
    console.log(`${maskablePath}, ${anyPath}`);
  }

  writeFileSync("app/apple-icon.png", await maskable(APPLE_SIZE));
  console.log(`app/apple-icon.png: ${APPLE_SIZE}px`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
