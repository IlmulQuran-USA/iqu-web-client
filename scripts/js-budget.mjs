#!/usr/bin/env node
/*
 * First-load JavaScript budget for public routes (CLAUDE.md §4 Performance,
 * PRODUCT.md: marketing-route JS < 180 KB gzipped).
 *
 * Run after `next build`. It starts `next start` on a spare port (or uses
 * JS_BUDGET_URL), requests every public page the build knows about plus a
 * missing path (the 404 page), and for each response takes every
 * <script src> the HTML loads, excluding the noModule polyfill chunk that
 * modern browsers skip: the "modern" first load. Each file is gzipped
 * (level 9) from .next/static and the sizes are summed. Pages are fetched
 * from the server, not read from .next/server/app, because routes that read
 * the URL (/courses, /instructors, /enroll) prerender an empty shell.
 * Dynamic routes are measured on every prerendered path; the table shows the
 * largest.
 *
 * Exits 1 when any public route is over the budget, so CI fails.
 *
 *   node scripts/js-budget.mjs            table; exit 1 when over budget
 *   node scripts/js-budget.mjs --json     per-route and per-page numbers as JSON
 *   JS_BUDGET_KB=190                      another budget (KB = 1000 bytes)
 *   JS_BUDGET_URL=http://localhost:3000   measure a server already running `next start`
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, ".next");
const APP = join(NEXT_DIR, "server", "app");
const BUDGET_KB = Number(process.env.JS_BUDGET_KB ?? 180);
const json = process.argv.includes("--json");
const MISSING = "/js-budget-missing-page";

/** Not public: development pages, previews and the global error boundary. */
const PRIVATE = [/^\/dev(\/|$)/, /^\/preview(\/|$)/, /^\/_global-error$/, /^\/_not-found$/];

if (!existsSync(APP)) {
  console.error("No build found: run `npm run build` first.");
  process.exit(2);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (name.endsWith(".html")) out.push(path);
  }
  return out;
}

// Every prerendered page; a [param].html shell names the route of its siblings.
const pages = [];
const shells = new Map();
for (const file of walk(APP)) {
  let path = "/" + relative(APP, file).split(sep).join("/").replace(/\.html$/, "");
  if (path === "/index") path = "/";
  if (PRIVATE.some((re) => re.test(path))) continue;
  const shell = path.match(/^(.*)\/(\[[^\]]+\])$/);
  if (shell) shells.set(shell[1], path);
  else pages.push(path);
}
const routeOf = (path) => (path === MISSING ? "404" : (shells.get(path.slice(0, path.lastIndexOf("/"))) ?? path));
pages.push(MISSING);

const gzCache = new Map();
function gzipSize(src) {
  if (!gzCache.has(src)) {
    const file = join(NEXT_DIR, decodeURIComponent(src.replace(/^\/_next\//, "").split("?")[0]));
    gzCache.set(src, gzipSync(readFileSync(file), { level: 9 }).length);
  }
  return gzCache.get(src);
}

function scriptsOf(html) {
  const out = [];
  for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
    const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
    if (!src || !src.startsWith("/_next/")) continue;
    if (/\snomodule(=|\s|>)/i.test(tag)) continue;
    out.push(src.replace(/&amp;/g, "&"));
  }
  return [...new Set(out)];
}

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
  const bin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [bin, "start", "-p", String(port), "-H", "127.0.0.1"], {
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
      await fetch(base + "/robots.txt");
      return { base, stop: () => child.kill() };
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  child.kill();
  throw new Error(`next start did not answer within 60 s:\n${log}`);
}

/*
 * Code every public page loads right after hydration with import(), so it is
 * never a <script src> in the HTML, but is still part of the first load: the
 * cookie banner's runtime (src/components/consent/consent-runtime.ts), loaded
 * on every page by the site Header or the enroll screens (owner, 27 Nov 2026:
 * "banner code counted"). Found by a string only that module contains; each
 * importing chunk group may get its own copy, so the largest is counted, on
 * every route. A missing marker fails the run, so the count can't silently
 * stop.
 */
const AFTER_HYDRATION = [{ name: "cookie banner", marker: "[data-consent-action], [data-consent-open]" }];
const CHUNKS = join(NEXT_DIR, "static", "chunks");
const afterHydration = AFTER_HYDRATION.map(({ name, marker }) => {
  let best = null;
  for (const file of readdirSync(CHUNKS)) {
    if (!file.endsWith(".js")) continue;
    if (!readFileSync(join(CHUNKS, file), "utf8").includes(marker)) continue;
    const src = `/_next/static/chunks/${file}`;
    if (!best || gzipSize(src) > gzipSize(best)) best = src;
  }
  if (!best) {
    console.error(`No chunk contains the ${name} marker (${marker}): update AFTER_HYDRATION in scripts/js-budget.mjs.`);
    process.exit(2);
  }
  return { name, src: best };
});

const server = process.env.JS_BUDGET_URL
  ? { base: process.env.JS_BUDGET_URL.replace(/\/$/, ""), stop: () => {} }
  : await startServer();

const results = [];
try {
  for (const path of pages) {
    const res = await fetch(server.base + path, { redirect: "follow" });
    const html = await res.text();
    const own = scriptsOf(html);
    // A page with no scripts at all stays empty, so a broken page still shows as NO SCRIPTS.
    const scripts = own.length ? [...own, ...afterHydration.map((a) => a.src).filter((src) => !own.includes(src))] : own;
    const bytes = scripts.reduce((sum, src) => sum + gzipSize(src), 0);
    results.push({ route: routeOf(path), page: path, status: res.status, scripts, bytes });
  }
} finally {
  server.stop();
}

const byRoute = new Map();
for (const r of results) {
  const prev = byRoute.get(r.route);
  const paths = (prev?.paths ?? 0) + 1;
  byRoute.set(r.route, !prev || r.bytes > prev.bytes ? { ...r, paths } : { ...prev, paths });
}
const rows = [...byRoute.values()].sort((a, b) =>
  a.route === "404" ? 1 : b.route === "404" ? -1 : a.route.localeCompare(b.route),
);

const kb = (b) => (b / 1000).toFixed(1);
const over = rows.filter((r) => r.bytes > BUDGET_KB * 1000);
const broken = rows.filter((r) => r.scripts.length === 0);

if (json) {
  console.log(
    JSON.stringify(
      {
        budgetKB: BUDGET_KB,
        routes: rows.map(({ scripts, ...r }) => ({ ...r, files: scripts.length })),
        pages: results.map((r) => ({ ...r, scripts: r.scripts.map((s) => ({ src: s, gz: gzipSize(s) })) })),
      },
      null,
      2,
    ),
  );
} else {
  const w = Math.max(...rows.map((r) => r.route.length), 5);
  console.log(`Modern first-load JS: gzip -9 of every <script src> in the HTML, noModule excluded. Budget ${BUDGET_KB} KB.`);
  for (const a of afterHydration) console.log(`Includes on every route, loaded after hydration: the ${a.name} (${kb(gzipSize(a.src))} KB, ${a.src}).`);
  console.log("");
  console.log(`${"Route".padEnd(w)}  ${"KB gz".padStart(7)}  ${"files".padStart(5)}  measured on`);
  for (const r of rows) {
    const flag = r.bytes > BUDGET_KB * 1000 ? "   OVER" : r.scripts.length === 0 ? "   NO SCRIPTS" : "";
    const on = r.paths > 1 ? `${r.page} (largest of ${r.paths})` : r.page;
    console.log(`${r.route.padEnd(w)}  ${kb(r.bytes).padStart(7)}  ${String(r.scripts.length).padStart(5)}  ${on}${flag}`);
  }
}

if (broken.length) {
  console.error(`\nNo scripts found on: ${broken.map((r) => `${r.route} (HTTP ${r.status})`).join(", ")}. The measurement is not trustworthy.`);
  process.exit(1);
}
if (over.length) {
  console.error(`\n${over.length} route(s) over the ${BUDGET_KB} KB budget: ${over.map((r) => r.route).join(", ")}`);
  process.exit(1);
}
if (!json) console.log(`\nAll ${rows.length} public routes within ${BUDGET_KB} KB.`);
