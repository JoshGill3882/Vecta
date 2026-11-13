// Regenerates the browser and launcher icons from public/logo.svg.
//
// Every icon is the flat mark on the app's dark background, #0a0c10, and is
// centred on the ring rather than on the whole mark: the squares beside the
// ring would otherwise pull the centre off the shape the eye lines up. Each is
// framed as closely as its platform's shape allows.
//
//   public/icons/icon-{192,512}.png      the desktop pair, the manifest's
//                    `purpose: "any"` icons. A rounded tile, transparent outside
//                    its curve, since a desktop shows the icon unmasked.
//   public/icons/maskable-{192,512}.png  the phone pair. Opaque and full-bleed,
//                    with the mark inside the centred safe circle, because a
//                    launcher may crop to any shape from a circle to a squircle.
//   app/apple-icon.png                   iOS's home-screen icon. Opaque and
//                    full-bleed, framed closer than the phone pair, since iOS
//                    only rounds the corners. Next links it itself.
//   app/favicon.ico  the tab icon for every browser: the desktop tile at 16, 32
//                    and 48px.
//   app/icon.svg     the tab icon for browsers that take an SVG: the desktop
//                    tile with the mark's shapes inline, sharp at any size.
//
// The launcher icons live in public/ rather than as app/icon*.png files because
// Next turns every icon file under app/ into a <link rel="icon"> tag, and these
// are for the manifest, not the tab.
//
// Run: `npm run icons:generate` — then commit whatever changed.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

/** The app's background (`--background`), and the ground behind the mark. */
export const GROUND = { r: 0x0a, g: 0x0c, b: 0x10 };

/** Entry sizes in the .ico. */
export const ICO_SIZES = [16, 32, 48];

/** Square sizes of the launcher icons the manifest lists. */
export const LAUNCHER_SIZES = [192, 512];

/** Size iOS asks for its home-screen icon. */
export const APPLE_SIZE = 180;

/** Corner radius of the desktop tile, as a fraction of its width.
 *
 * About 19%, a conventional app-icon curve.
 */
export const TILE_RADIUS = 0.1875;

/** How wide the mark's reach is on a phone icon, as a fraction of the icon.
 *
 * The reach is the circle through the mark's furthest solid point. A launcher
 * may crop a maskable icon to any shape, and the centred circle 80% wide is the
 * area every one of them keeps, so the whole mark stays inside it.
 */
export const SAFE_FRACTION = 0.8;

/** How wide the mark's reach is on the iPhone icon, as a fraction of the icon.
 *
 * Above 1, so the reach runs past the icon's edges. That only happens at the
 * corners, which the mark leaves empty except for the squares, and iOS rounds
 * its icons by about 22%, a curve the squares stay inside at this framing.
 */
export const APPLE_FRACTION = 1.04;

/** How wide the mark's reach is on the desktop tile, as a fraction of the tile.
 *
 * Closer than the iPhone's, because the tile's own corners are rounded less.
 * This is as close as the frame goes with the squares still inside its curve.
 */
export const ANY_FRACTION = 1.13;

/** Alpha above which a rendered pixel counts as part of the mark's shapes. */
export const SOLID_THRESHOLD = 128;

/** How large a solid shape must be, as a fraction of the largest, to centre on.
 *
 * Small pieces apart from the main shapes, such as the squares beside the
 * ring, are part of the mark but not what the eye centres it by.
 */
export const MAIN_PIECE_FRACTION = 0.1;

/** Width the mark is rendered at to measure it, in pixels. */
export const MEASURE_SIZE = 1880;

/** The viewBox and the drawing inside an SVG document.
 *
 * @param {string} svg - The document's text.
 * @returns {{ viewBox: { x: number, y: number, size: number }, body: string }}
 *   The square viewBox, and everything between the root element's tags.
 */
export function svgParts(svg) {
  const open = svg.match(/<svg\b[^>]*>/);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) throw new Error("Not an SVG document.");

  const box = open[0].match(/viewBox="([^"]+)"/);
  if (!box) throw new Error("The mark's SVG has no viewBox.");
  const [x, y, width, height] = box[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (width !== height) throw new Error("The mark's viewBox must be square.");

  const body = svg.slice(open.index + open[0].length, close).replace(/<!--[\s\S]*?-->/g, "");
  return { viewBox: { x, y, size: width }, body: body.trim() };
}

/** An SVG document showing one square of the mark, optionally grounded.
 *
 * @param {object} opts
 * @param {string} opts.body - The mark's drawing, from `svgParts`.
 * @param {{ left: number, top: number, size: number }} opts.frame - The square of
 *   the mark to show, in the mark's own units.
 * @param {number} [opts.size] - Width and height to render at, in pixels. Left
 *   out, the document scales to whatever shows it.
 * @param {number | null} [opts.radius] - The ground's corner radius, as a
 *   fraction of the frame. 0 is full-bleed; null leaves the ground out.
 * @returns {string}
 */
export function framedSvg({ body, frame, size, radius = null }) {
  const { left, top, size: span } = frame;
  const dimensions = size === undefined ? "" : ` width="${size}" height="${size}"`;
  const ground =
    radius === null
      ? ""
      : `  <rect x="${left}" y="${top}" width="${span}" height="${span}" rx="${radius * span}" fill="${toHex(GROUND)}"/>\n`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${span} ${span}"${dimensions}>\n${ground}  ${body}\n</svg>\n`;
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

/** The point the eye centres the mark by, in pixels.
 *
 * The middle of the box around the mark's main shapes, ignoring pieces too
 * small to count as one. Derived rather than hardcoded, so it still holds if
 * the mark is redrawn.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number }}
 */
export function markCentre(rgba, width, height) {
  const pieces = solidPieces(rgba, width, height);
  if (pieces.length === 0) throw new Error("The mark has no solid shape to centre on.");

  const main = pieces.filter((p) => p.pixels >= pieces[0].pixels * MAIN_PIECE_FRACTION);
  const left = Math.min(...main.map((p) => p.left));
  const right = Math.max(...main.map((p) => p.right)) + 1;
  const top = Math.min(...main.map((p) => p.top));
  const bottom = Math.max(...main.map((p) => p.bottom)) + 1;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** The distance from `centre` to the furthest solid pixel, the mark's reach.
 *
 * Measured over the pixels themselves rather than a bounding box: the mark is
 * round, so the corners of its box are empty, and a box would frame it smaller
 * than it needs to be.
 *
 * @param {Buffer|Uint8Array} rgba - Raw RGBA pixels, 4 bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number }} centre
 * @param {number} [threshold]
 * @returns {number}
 */
export function furthestSolid(rgba, width, height, centre, threshold = SOLID_THRESHOLD) {
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

/** The square of the mark an icon shows.
 *
 * Centred on `centre`, and sized so a circle of `radius` spans `fraction` of
 * the icon's width. Above 1, the circle runs past the edges.
 *
 * @param {{ x: number, y: number }} centre
 * @param {number} radius
 * @param {number} fraction
 * @returns {{ left: number, top: number, size: number }}
 */
export function iconWindow(centre, radius, fraction) {
  const size = (2 * radius) / fraction;
  return { left: centre.x - size / 2, top: centre.y - size / 2, size };
}

/** Assemble PNG buffers into an .ico container.
 *
 * The format is a 6-byte ICONDIR, one 16-byte ICONDIRENTRY per image, then the
 * payloads. Entries are PNG rather than BMP, which browsers accept.
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

/** `#rrggbb` for a sharp-style colour object. */
export function toHex({ r, g, b }) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Renders an SVG document to an RGBA PNG at the size it declares.
 *
 * RGBA even where every pixel is opaque, because Next's .ico decoder rejects
 * any entry whose PNG is not.
 *
 * @param {string} svg
 * @returns {Promise<Buffer>}
 */
function render(svg) {
  return sharp(Buffer.from(svg)).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const SOURCE = "public/logo.svg";
  const { viewBox, body } = svgParts(readFileSync(SOURCE, "utf8"));

  // Measured on a large render, then converted back to the mark's own units, so
  // every icon is drawn from the vectors rather than scaled from a raster.
  const scale = MEASURE_SIZE / viewBox.size;
  const measured = framedSvg({
    body,
    frame: { left: viewBox.x, top: viewBox.y, size: viewBox.size },
    size: MEASURE_SIZE,
  });
  const { data } = await sharp(Buffer.from(measured))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = markCentre(data, MEASURE_SIZE, MEASURE_SIZE);
  const centre = { x: viewBox.x + px.x / scale, y: viewBox.y + px.y / scale };
  const reach = furthestSolid(data, MEASURE_SIZE, MEASURE_SIZE, px) / scale;
  console.log(
    `${SOURCE}: ring centred at (${centre.x}, ${centre.y}), reaching ${reach.toFixed(1)}`
  );

  const tile = iconWindow(centre, reach, ANY_FRACTION);
  const phone = iconWindow(centre, reach, SAFE_FRACTION);
  const apple = iconWindow(centre, reach, APPLE_FRACTION);

  // --- app/favicon.ico -------------------------------------------------------
  const pngs = [];
  for (const size of ICO_SIZES) {
    pngs.push(await render(framedSvg({ body, frame: tile, size, radius: TILE_RADIUS })));
  }
  const ico = buildIco(pngs, ICO_SIZES);
  writeFileSync("app/favicon.ico", ico);
  console.log(`app/favicon.ico: ${ICO_SIZES.join("/")} at ${ico.length} B`);

  // --- app/icon.svg ----------------------------------------------------------
  const svg = framedSvg({ body, frame: tile, radius: TILE_RADIUS }).replace(
    ">\n",
    `>\n  <!-- GENERATED by scripts/generate-icons.mjs from ${SOURCE}. Do not hand-edit;\n       run \`npm run icons:generate\` instead. -->\n`
  );
  writeFileSync("app/icon.svg", svg);
  console.log(`app/icon.svg: ${svg.length} B`);

  // --- launcher icons --------------------------------------------------------
  mkdirSync("public/icons", { recursive: true });
  for (const size of LAUNCHER_SIZES) {
    const maskablePath = `public/icons/maskable-${size}.png`;
    writeFileSync(maskablePath, await render(framedSvg({ body, frame: phone, size, radius: 0 })));
    const anyPath = `public/icons/icon-${size}.png`;
    writeFileSync(
      anyPath,
      await render(framedSvg({ body, frame: tile, size, radius: TILE_RADIUS }))
    );
    console.log(`${maskablePath}, ${anyPath}`);
  }

  writeFileSync(
    "app/apple-icon.png",
    await render(framedSvg({ body, frame: apple, size: APPLE_SIZE, radius: 0 }))
  );
  console.log(`app/apple-icon.png: ${APPLE_SIZE}px`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
