#!/usr/bin/env node
/*
 * Instructor portraits → public/instructors/<slug>.webp
 *
 * The owner's cut-outs sit on a flat pastel card (a different colour per
 * person) with the head rising above the card. This script, per the owner's
 * decision of 19 Nov 2026:
 *   1. flood-fills the card from its own edges (so clothing of a similar
 *      colour that is not connected to the card is left alone) and replaces
 *      it with --surface #F1F5F9, the ground the arch monograms use;
 *   2. softens the boundary by removing the card's colour cast from pixels
 *      next to it, and composites the cut-out's transparent edges onto
 *      --surface;
 *   3. crops a square at native width with headroom above the cap, so the
 *      face sits centred in the arch frame.
 * Native size is kept (370 × 370): the 600 × 600 minimum is waived by the
 * owner until larger originals exist.
 *
 * Superseded (20 Nov 2026): the owner now supplies the final hero portraits
 * himself (600 × 600 WebP, shared framing). The script skips any output that
 * already exists, so it never overwrites them; --force overrides that.
 *
 * Usage: node scripts/instructor-portraits.mjs [sourceDir] [--force]   (default design/brand-source)
 * The mapping below was confirmed file by file by the owner. Never infer it
 * from a face.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const FORCE = process.argv.includes("--force");
const SOURCE_DIR = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "design/brand-source";
const OUT_DIR = "public/instructors";
const SURFACE = [0xf1, 0xf5, 0xf9];

// radius / feather: how far from the card, in px and in colour distance, a
// pixel can still carry the card's cast. Wider only where the clothing is far
// from the card colour (Ariful Islam: semi-transparent hair and beard over a
// lilac card, dark navy clothes); 2 / 40 elsewhere so pale fabric that is
// close to the card colour (Shaker Waliullah's shirt, ~34 away) is left alone.
const MAP = {
  "Ariful islam.png": { slug: "mufti-ariful-islam", radius: 14, feather: 90 },
  "Mufti Shaker Waliullah.png": { slug: "mufti-shaker-waliullah", radius: 2, feather: 40 },
  "Mufti Muhammad Faijullah.png": { slug: "mufti-muhammad-faijullah", radius: 2, feather: 40 },
  "Ahmed Mostafa Raian.png": { slug: "mufti-ahmed-mostafa-raian", radius: 2, feather: 40 },
  "Nurul ahsan v4.png": { slug: "hafez-nurul-ahsan", radius: 2, feather: 40 },
};

const CORE = 4; // colour distance treated as pure card (the cards are flat fills: measured noise 0)
const HEADROOM = 24; // px of --surface added above the cap

const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));
const dist = (r, g, b, c) => Math.hypot(r - c[0], g - c[1], b - c[2]);

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

async function processOne(file, { slug, radius, feather: FEATHER }) {
  const { data, info } = await sharp(path.join(SOURCE_DIR, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => (y * W + x) * 4;

  // Card colour: median of two patches inside the card, left and right edges.
  const samples = [[], [], []];
  for (const x0 of [4, W - 15]) {
    for (let y = 120; y < 140; y++) {
      for (let x = x0; x < x0 + 10; x++) {
        const i = px(x, y);
        if (data[i + 3] > 250) for (let c = 0; c < 3; c++) samples[c].push(data[i + c]);
      }
    }
  }
  const card = samples.map(median);

  // Flood fill: transparent pixels and card-coloured pixels connected to them.
  const bg = new Uint8Array(W * H);
  const queue = [];
  const isBgCandidate = (x, y) => {
    const i = px(x, y);
    return data[i + 3] < 128 || dist(data[i], data[i + 1], data[i + 2], card) < CORE;
  };
  const seed = (x, y) => {
    if (!bg[y * W + x] && isBgCandidate(x, y)) {
      bg[y * W + x] = 1;
      queue.push(y * W + x);
    }
  };
  for (let x = 0; x < W; x++) seed(x, 0);
  for (let y = 0; y < H; y++) {
    seed(0, y);
    seed(W - 1, y);
  }
  while (queue.length) {
    const k = queue.pop();
    const x = k % W;
    const y = (k - x) / W;
    if (x > 0) seed(x - 1, y);
    if (x < W - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < H - 1) seed(x, y + 1);
  }

  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = px(x, y);
      const o = (y * W + x) * 3;
      if (bg[y * W + x]) {
        out.set(SURFACE, o);
        continue;
      }
      let [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // Boundary: within radius px of the card, remove its colour cast in proportion.
      let nearCard = false;
      for (let dy = -radius; dy <= radius && !nearCard; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && bg[ny * W + nx] && data[px(nx, ny) + 3] >= 128) {
            nearCard = true;
            break;
          }
        }
      }
      if (nearCard) {
        const d = dist(r, g, b, card);
        if (d < FEATHER) {
          const bgWeight = 1 - Math.min(1, Math.max(0, (d - CORE) / (FEATHER - CORE)));
          r += bgWeight * (SURFACE[0] - card[0]);
          g += bgWeight * (SURFACE[1] - card[1]);
          b += bgWeight * (SURFACE[2] - card[2]);
        }
      }
      // Cut-out edges (partial alpha) composite onto --surface.
      const a = data[i + 3] / 255;
      // Clamp: removing the cast can push a channel outside 0–255, and a Buffer would wrap it.
      out[o] = clamp(a * r + (1 - a) * SURFACE[0]);
      out[o + 1] = clamp(a * g + (1 - a) * SURFACE[1]);
      out[o + 2] = clamp(a * b + (1 - a) * SURFACE[2]);
    }
  }

  // Square at native width: HEADROOM of --surface on top, source rows below.
  const size = W;
  const target = path.join(OUT_DIR, `${slug}.webp`);
  // The owner's own final files (20 Nov 2026) must never be overwritten by this script.
  if (!FORCE && existsSync(target)) {
    console.log(`${file.padEnd(30)} → ${target}  exists, skipped (--force to overwrite)`);
    return;
  }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: 0, top: 0, width: W, height: size - HEADROOM })
    .extend({ top: HEADROOM, background: { r: SURFACE[0], g: SURFACE[1], b: SURFACE[2] } })
    .webp({ quality: 88, effort: 6 })
    .toFile(target);
  const meta = await sharp(target).metadata();
  console.log(`${file.padEnd(30)} → ${target}  ${meta.width}×${meta.height}  card rgb(${card.join(",")})`);
}

await import("node:fs").then((fs) => fs.mkdirSync(OUT_DIR, { recursive: true }));
for (const [file, opts] of Object.entries(MAP)) await processOne(file, opts);
