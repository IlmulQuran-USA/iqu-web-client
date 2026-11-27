#!/usr/bin/env node
/*
 * SEO parity check on a real build (owner, 27 Nov 2026). Run after
 * `next build`; it starts `next start` on a spare port (or uses SEO_CHECK_URL)
 * and checks, as served:
 *
 * 1. Every page in the sitemap list (src/content/sitemap.ts): 200, one <h1>,
 *    a <title>, a meta description (≤ 160 characters), a canonical that is
 *    absolute on the site's origin and equal to the page's own path, og:title,
 *    og:image (absolute), and JSON-LD blocks that parse.
 * 2. Every live WordPress URL from the inventory (src/content/legacy-*.ts),
 *    with and without its trailing slash and as /?p=…: at most ONE redirect,
 *    a 301, to a page that answers 200 with no further redirect.
 * 3. robots.txt and X-Robots-Tag for this build's environment: staging is
 *    "Disallow: /" with noindex on every response; production allows, names
 *    the sitemap, and sends no noindex header.
 *
 * Exits 1 on any failure, so CI fails.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
// Content modules import without extensions; resolve them as the unit tests do.
nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:")) target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (target && !path.extname(target)) {
      for (const ext of [".ts", ".tsx"]) if (existsSync(target + ext)) return nextResolve(pathToFileURL(target + ext).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { sitemapEntries } = await import(pathToFileURL(path.join(SRC, "content/sitemap.ts")).href);
const { liveAttachments, liveContent } = await import(pathToFileURL(path.join(SRC, "content/legacy-inventory.ts")).href);
const { live404Fixes, liveArchivePaths, livePagePaths } = await import(pathToFileURL(path.join(SRC, "content/legacy-paths.ts")).href);
const { isProductionSite, siteUrl } = await import(pathToFileURL(path.join(SRC, "lib/site-env.ts")).href);

const production = isProductionSite();
const origin = siteUrl().origin;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited:\n${log}`);
    try {
      await fetch(`${base}/robots.txt`);
      return { base, stop: () => child.kill() };
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  child.kill();
  throw new Error(`next start did not answer within 60 s:\n${log}`);
}

const server = process.env.SEO_CHECK_URL ? { base: process.env.SEO_CHECK_URL.replace(/\/$/, ""), stop: () => {} } : await startServer();
const failures = [];
const fail = (msg) => failures.push(msg);
const attr = (html, re) => html.match(re)?.[1]?.replace(/&amp;/g, "&") ?? "";

try {
  // 1. Pages.
  const pages = sitemapEntries(origin).map((e) => new URL(e.url).pathname);
  for (const p of pages) {
    const res = await fetch(server.base + p, { redirect: "manual" });
    if (res.status !== 200) {
      fail(`${p}: HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    const title = attr(html, /<title>([^<]*)<\/title>/);
    const description = attr(html, /<meta name="description" content="([^"]*)"/);
    const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
    const ogImage = attr(html, /<meta property="og:image" content="([^"]*)"/);
    const ogTitle = attr(html, /<meta property="og:title" content="([^"]*)"/);
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (!title) fail(`${p}: no <title>`);
    if (!description) fail(`${p}: no meta description`);
    else if (description.length > 160) fail(`${p}: description ${description.length} characters`);
    // Next writes the home canonical as the bare origin ("https://x"); that is the same URL as "https://x/".
    const same = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");
    if (!same(canonical, new URL(p, origin).toString())) fail(`${p}: canonical "${canonical}", expected ${new URL(p, origin)}`);
    if (!/^https?:\/\//.test(ogImage)) fail(`${p}: og:image "${ogImage}"`);
    if (!ogTitle) fail(`${p}: no og:title`);
    if (h1 !== 1) fail(`${p}: ${h1} <h1>`);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const doc = JSON.parse(json);
        if (doc["@context"] !== "https://schema.org" || !doc["@type"]) fail(`${p}: JSON-LD without @context/@type`);
      } catch {
        fail(`${p}: JSON-LD does not parse`);
      }
    }
  }

  // 2. Legacy URLs: one 301 to a 200.
  const legacy = new Set();
  for (const [id, , live] of liveContent) {
    legacy.add(live);
    if (live !== "/") legacy.add(`${live}/`);
    legacy.add(`/?p=${id}`);
  }
  for (const [id, live] of liveAttachments) legacy.add(live.includes("?") ? `/?attachment_id=${id}` : `${live}/`);
  for (const p of [...Object.keys(livePagePaths), ...Object.keys(liveArchivePaths), ...Object.keys(live404Fixes)]) {
    legacy.add(p);
    if (p !== "/") legacy.add(`${p}/`);
  }
  let hops = 0;
  for (const url of legacy) {
    const first = await fetch(server.base + url, { redirect: "manual" });
    let finalUrl = url;
    if (first.status === 301) {
      hops++;
      finalUrl = new URL(first.headers.get("location"), server.base + url).pathname;
    } else if (first.status !== 200) {
      fail(`${url}: HTTP ${first.status} (expected 301 or 200)`);
      continue;
    }
    if (first.status === 301) {
      const second = await fetch(server.base + finalUrl, { redirect: "manual" });
      if (second.status !== 200) fail(`${url} → ${finalUrl}: HTTP ${second.status} (a second hop or a dead end)`);
    }
  }

  // 3. robots.txt and noindex per environment.
  const robots = await (await fetch(`${server.base}/robots.txt`)).text();
  const home = await fetch(`${server.base}/`);
  const header = home.headers.get("x-robots-tag") ?? "";
  if (production) {
    if (!/Allow: \//.test(robots) || !robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail(`robots.txt (production):\n${robots}`);
    if (/noindex/.test(header)) fail("production sends X-Robots-Tag noindex");
    const xml = await (await fetch(`${server.base}/sitemap.xml`)).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (locs.length !== pages.length) fail(`sitemap.xml lists ${locs.length} URLs, expected ${pages.length}`);
    if ((xml.match(/<lastmod>/g) ?? []).length !== locs.length) fail("sitemap.xml: a URL without <lastmod>");
    for (const old of ["/sitemap_index.xml", "/page-sitemap.xml", "/iq_instructor-sitemap.xml"]) {
      const r = await fetch(server.base + old, { redirect: "manual" });
      if (r.status !== 301 || new URL(r.headers.get("location"), server.base).pathname !== "/sitemap.xml") fail(`${old}: ${r.status} → ${r.headers.get("location")}`);
    }
  } else {
    if (!/Disallow: \/\s*$/m.test(robots) || /Sitemap:/.test(robots)) fail(`robots.txt (staging) must be Disallow: / with no sitemap:\n${robots}`);
    if (header !== "noindex, nofollow") fail(`staging X-Robots-Tag is "${header}"`);
    const sitemap = await fetch(`${server.base}/sitemap.xml`, { redirect: "manual" });
    if (sitemap.status !== 404) fail(`staging /sitemap.xml answers ${sitemap.status}`);
  }

  console.log(`SEO check (${production ? "production" : "staging"} build, origin ${origin})`);
  console.log(`  ${pages.length} pages: title, description, canonical, og:image, one h1, JSON-LD`);
  console.log(`  ${legacy.size} live WordPress URLs: ${hops} answered with one 301, the rest served as they are`);
  console.log(`  robots.txt and X-Robots-Tag for ${production ? "production" : "staging"}`);
} finally {
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.map((f) => `  ✖ ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("All checks passed.");
