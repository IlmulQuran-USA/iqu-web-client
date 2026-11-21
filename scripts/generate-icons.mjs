#!/usr/bin/env node
/**
 * node scripts/generate-icons.mjs
 *
 * Builds every favicon and app icon from the logo mark, the emblem of
 * public/brand/logo-header.svg without the name. The artwork is copied, never
 * redrawn or recoloured (Logo.tsx: the navy and orange are the brand's own).
 *
 *   public/brand/mark.svg                  the emblem alone, square viewBox (source for the rest)
 *   src/app/icon.svg                       browser tab icon; white in dark mode, like logo-footer.svg
 *   src/app/favicon.ico                    16, 32 and 48 px (PNG entries)
 *   src/app/apple-icon.png                 180 × 180, mark on --paper with padding
 *   public/brand/icons/icon-192.png        manifest, purpose "any"
 *   public/brand/icons/icon-512.png        manifest, purpose "any"
 *   public/brand/icons/icon-maskable-512.png  manifest, purpose "maskable": mark inside the 80% safe zone
 *
 * Uses sharp, which ships with Next.js. Re-run after the logo changes and
 * commit the output.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const at = (...p) => path.join(ROOT, ...p);

/** --paper (DESIGN.md §2). */
const PAPER = "#FFFFFF";

// The logo is one <g> holding two groups: the emblem, then the name. Keep the emblem.
const logo = readFileSync(at("public/brand/logo-header.svg"), "utf8");
const style = logo.match(/<style[\s\S]*?<\/style>/)[0];
const groups = logo.split(/\n\t<g>\n/);
if (groups.length !== 3) throw new Error("logo-header.svg no longer has the emblem + name structure this script expects");
const emblem = `<g>\n${groups[1].replace(/\n\t<\/g>\s*$/, "")}\n\t</g>`;
if (/M165\.41/.test(emblem) || !/M134\.9,73\.97/.test(emblem)) throw new Error("Emblem extraction picked up the wrong group");

// The emblem's bounds in the logo's coordinates (its viewBox starts at the emblem's left and top edge).
const box = { x: 45.27, y: 21.54, w: 147.61 - 45.27, h: 113.3 - 21.54 };

/** The emblem centred in a square viewBox, with `pad` as a share of the side on each edge. */
function squareSvg(pad, extraStyle = "") {
  const side = Math.max(box.w, box.h) / (1 - 2 * pad);
  const x = box.x + box.w / 2 - side / 2;
  const y = box.y + box.h / 2 - side / 2;
  const css = extraStyle ? style.replace("</style>", `${extraStyle}\n</style>`) : style;
  const r = (n) => Number(n.toFixed(2));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(x)} ${r(y)} ${r(side)} ${r(side)}">\n${css}\n${emblem}\n</svg>\n`;
}

async function png(svg, size, background) {
  let img = sharp(Buffer.from(svg), { density: 72 * Math.ceil(size / 64) }).resize(size, size);
  if (background) img = img.flatten({ background });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

/** An .ico whose entries are PNGs (supported by every current browser and by Windows Vista onward). */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dir = entries.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]);
}

const write = (rel, data) => {
  mkdirSync(path.dirname(at(rel)), { recursive: true });
  writeFileSync(at(rel), data);
  console.log(`  ${rel}`);
};

const mark = squareSvg(0);
const tab = squareSvg(0.04, "\t@media (prefers-color-scheme: dark) { .st0, .st1 { fill: #FFFFFF; } }");
const small = squareSvg(0.04);

write("public/brand/mark.svg", mark);
write("src/app/icon.svg", tab);
write(
  "src/app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(small, size) })))),
);
write("src/app/apple-icon.png", await png(squareSvg(0.14), 180, PAPER));
write("public/brand/icons/icon-192.png", await png(squareSvg(0.08), 192, PAPER));
write("public/brand/icons/icon-512.png", await png(squareSvg(0.08), 512, PAPER));
// Maskable: launchers crop to a circle of 80% diameter; keep the mark well inside it.
write("public/brand/icons/icon-maskable-512.png", await png(squareSvg(0.22), 512, PAPER));
