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
import { createHmac, randomBytes } from "node:crypto";
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

/** Not public: development pages, previews, the global error boundary, and the portal (measured on its own below). */
const PRIVATE = [
  /^\/dev(\/|$)/,
  /^\/preview(\/|$)/,
  /^\/_global-error$/,
  /^\/_not-found$/,
  /^\/[apst](\/|$)/,
  /^\/login$/,
  /^\/forgot-password$/,
];

/*
 * The portal and admin (owner, 27 Nov 2026; plan frontend-portal-admin-plan.md
 * §9): their own budgets, signed in as each role. 220 KB for the sign-in
 * pages and the student, parent and teacher portals; 260 KB for the admin.
 * The script signs its own preview sessions: when it starts the server, it
 * gives it a random throwaway preview password (never the real one) and
 * mock data; with JS_BUDGET_URL it uses PREVIEW_DEFAULT_PASSWORD from the
 * environment if set, otherwise the portal is not measured. A build where
 * the portal is closed (404) is reported, not failed.
 */
const PORTAL_KB = Number(process.env.JS_BUDGET_PORTAL_KB ?? 220);
const ADMIN_KB = Number(process.env.JS_BUDGET_ADMIN_KB ?? 260);
const PORTAL_PAGES = [
  { path: "/login", account: null, budget: PORTAL_KB },
  { path: "/forgot-password", account: null, budget: PORTAL_KB },
  { path: "/s/overview", account: { sub: "acc-student", email: "student@ilmulquranus.org", name: "Farhana Karim", roles: ["student"] }, budget: PORTAL_KB },
  { path: "/p/overview", account: { sub: "acc-parent", email: "parent@ilmulquranus.org", name: "Amina Siddiqui", roles: ["parent"] }, budget: PORTAL_KB },
  { path: "/t/today", account: { sub: "acc-teacher", email: "teacher@ilmulquranus.org", name: "Hafez Imran Chowdhury", roles: ["teacher"] }, budget: PORTAL_KB },
  { path: "/a/live", account: { sub: "acc-admin", email: "admin@ilmulquranus.org", name: "Preview Admin", roles: ["admin", "billing_admin"] }, budget: ADMIN_KB },
];

/** The same token src/lib/auth/session.ts signs: base64url(JSON).base64url(HMAC(derived key, payload)). */
function previewToken(account, secret) {
  const derived = createHmac("sha256", secret).update("iqu-preview-session:v1").digest();
  const payload = Buffer.from(JSON.stringify({ ...account, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `${payload}.${createHmac("sha256", derived).update(payload).digest("base64url")}`;
}

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

/** A throwaway preview password for the server this script starts (never the real one). */
const OWN_PREVIEW_PASSWORD = randomBytes(24).toString("base64url");

async function startServer() {
  const port = await freePort();
  const bin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [bin, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", PORTAL_DATA: "mock", PREVIEW_DEFAULT_PASSWORD: OWN_PREVIEW_PASSWORD },
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
const portalResults = [];
let portalNote = "";
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

  // The portal, signed in as each role.
  const secret = process.env.JS_BUDGET_URL ? (process.env.PREVIEW_DEFAULT_PASSWORD ?? "") : OWN_PREVIEW_PASSWORD;
  if (!secret) portalNote = "Portal not measured: no PREVIEW_DEFAULT_PASSWORD for the server at JS_BUDGET_URL.";
  else {
    for (const p of PORTAL_PAGES) {
      const headers = p.account ? { cookie: `iqu_preview_session=${previewToken(p.account, secret)}` } : {};
      const res = await fetch(server.base + p.path, { redirect: "manual", headers });
      if (res.status === 404) {
        portalNote = "Portal closed on this build (404): not measured.";
        break;
      }
      const scripts = scriptsOf(await res.text());
      portalResults.push({ route: p.path, status: res.status, scripts, bytes: scripts.reduce((sum, src) => sum + gzipSize(src), 0), budget: p.budget });
    }
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

const portalOver = portalResults.filter((r) => r.bytes > r.budget * 1000);
const portalBroken = portalResults.filter((r) => r.status !== 200 || r.scripts.length === 0);
if (!json) {
  console.log(`\nPortal and admin (signed in as each role): budget ${PORTAL_KB} KB, admin ${ADMIN_KB} KB.`);
  if (portalNote) console.log(portalNote);
  for (const r of portalResults) {
    const flag = r.status !== 200 ? `   HTTP ${r.status}` : r.bytes > r.budget * 1000 ? "   OVER" : "";
    console.log(`${r.route.padEnd(18)}  ${kb(r.bytes).padStart(7)}  ${String(r.scripts.length).padStart(5)}  budget ${r.budget}${flag}`);
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
if (portalBroken.length) {
  console.error(`\nPortal pages that did not answer 200 with scripts: ${portalBroken.map((r) => `${r.route} (HTTP ${r.status})`).join(", ")}.`);
  process.exit(1);
}
if (portalOver.length) {
  console.error(`\nPortal route(s) over budget: ${portalOver.map((r) => r.route).join(", ")}`);
  process.exit(1);
}
if (!json) console.log(`\nAll ${rows.length} public routes within ${BUDGET_KB} KB${portalResults.length ? `; all ${portalResults.length} portal routes within budget` : ""}.`);
