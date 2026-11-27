import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
 * The domain-switch redirect map (src/lib/legacy-redirect.ts, the live
 * inventory in src/content/legacy-inventory.ts and legacy-paths.ts). Some
 * content modules import without extensions, so they resolve as in faq.test.ts.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
type Resolve = (specifier: string, context: { parentURL?: string }) => unknown;
type ResolveHook = (specifier: string, context: { parentURL?: string }, nextResolve: Resolve) => unknown;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target: string | null = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:")) target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (target && !path.extname(target)) {
      for (const ext of [".ts", ".tsx"]) if (existsSync(target + ext)) return nextResolve(pathToFileURL(target + ext).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { legacyHop } = await import("./legacy-redirect.ts");
const { legacyRedirectMap, live404Fixes, liveArchivePaths, livePagePaths, fileRedirects, liveSitemapPaths } = await import("../content/legacy-paths.ts");
const { liveAttachments, liveContent } = await import("../content/legacy-inventory.ts");
const { courses } = await import("../content/courses.ts");
const { programs } = await import("../content/pricing.ts");
const { instructorIds } = await import("../content/instructors.ts");
const legal = await import("../content/legal.ts");
const legalDocs = [legal.privacyPolicy, legal.termsAndConditions, legal.refundPolicy, legal.accessibilityStatement];

/** Every page the new site really serves: static routes plus each known dynamic slug. */
function builtPages(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, route: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) {
        if (!name.startsWith("[") && !["dev", "preview", "api", "actions"].includes(name)) walk(p, `${route}/${name}`);
      } else if (name === "page.tsx") out.add(route || "/");
    }
  };
  walk(path.join(SRC, "app"), "");
  for (const c of courses) out.add(c.href);
  for (const p of Object.values(programs)) out.add(p.href);
  for (const id of instructorIds) out.add(`/instructors/${id}`);
  for (const d of legalDocs) out.add(d.path);
  return out;
}

const pages = builtPages();

/** Follows one request: the hop, and whether its target is a final, built page. */
function oneHop(url: string) {
  const u = new URL(url, "https://ilmulquranus.org");
  const hop = legacyHop(u.pathname, u.search);
  const location = hop ? new URL(hop.location, u) : u;
  return { hop, final: location.pathname, again: legacyHop(location.pathname, location.search) };
}

test("every live page, course and instructor (with and without the slash) reaches its built page in ONE 301", () => {
  for (const [id, , live] of liveContent) {
    for (const url of live === "/" ? ["/"] : [live, `${live}/`]) {
      const { hop, final, again } = oneHop(url);
      assert.equal(again, null, `${url} → ${final} redirects again`);
      assert.ok(pages.has(final), `${url} → ${final} is not a built page`);
      if (hop) assert.equal(hop.status, 301, `${url}: ${hop.status}`);
      else assert.equal(final, url, `${url} is served as is only when the path is unchanged`);
    }
    // The WordPress ID links too.
    for (const key of ["p", "page_id"]) {
      const { hop, final } = oneHop(`/?${key}=${id}`);
      assert.equal(hop?.status, 301);
      assert.ok(pages.has(final), `?${key}=${id} → ${final}`);
    }
  }
});

test("every public attachment page, archive, feed and 404-log fix lands on a built page in one hop (never a 404)", () => {
  const sources = [
    ...liveAttachments.map(([id, p]) => (p.includes("?") ? `/?attachment_id=${id}` : `${p}/`)),
    ...Object.keys(liveArchivePaths).map((p) => `${p}/`),
    ...Object.keys(live404Fixes),
    ...Object.keys(livePagePaths),
  ];
  assert.ok(sources.length > 300);
  for (const url of sources) {
    const { hop, final, again } = oneHop(url);
    assert.equal(again, null, `${url} → ${final} redirects again`);
    assert.ok(pages.has(final), `${url} → ${final} is not a built page`);
    if (url !== final) assert.equal(hop?.status, 301, `${url}`);
  }
});

test("the important URLs go to their own page, not to a catch-all", () => {
  const expect: Record<string, string> = {
    "/course/quran-memorization/": "/courses/quran-hifz",
    "/course/nurani-qaida-for-kids/": "/courses/noorani-qaidah",
    "/course/summer-islamic-education-program/": "/programs/summer-ilm-camp",
    "/weekend-program/": "/programs/weekend-ilm-program",
    "/enroll-for-free/": "/enroll",
    "/tuition-refund-policy/": "/legal/refund",
    "/privacy-policy/": "/legal/privacy",
    "/instructor/sheikh-hussain-muhammad/": "/instructors/mawlana-nazrul-islam",
    "/instructor/muhamad-raiyan/dsc_0448/": "/instructors/mufti-ahmed-mostafa-raian",
    "/about/attachment/02/": "/about",
    "/author/nurulahsan/": "/instructors/hafez-nurul-ahsan",
    "/?page_id=18": "/about",
    "/about/": "/about",
  };
  for (const [from, to] of Object.entries(expect)) assert.equal(oneHop(from).final, to, from);
});

test("query strings: WordPress keys dropped, campaign tags kept", () => {
  assert.deepEqual(legacyHop("/course/quran-nazirah/", "?utm_source=fb&p=126"), { status: 301, location: "/courses/quran-nazirah?utm_source=fb" });
  assert.deepEqual(legacyHop("/", "?p=126&fbclid=x"), { status: 301, location: "/courses/quran-nazirah?fbclid=x" });
});

test("the rest of the site keeps Next.js's slash handling: 308 to the path without it, no change otherwise", () => {
  assert.deepEqual(legacyHop("/faq/"), { status: 308, location: "/faq" });
  assert.deepEqual(legacyHop("/courses/quran-hifz/", "?x=1"), { status: 308, location: "/courses/quran-hifz?x=1" });
  for (const p of ["/", "/faq", "/courses/quran-hifz", "/instructors/maha-rashed", "/legal/privacy", "/enroll"]) assert.equal(legacyHop(p), null, p);
  // A built page is never a redirect source (no live path shadows a new route).
  for (const p of pages) assert.ok(legacyHop(p) === null, `${p} is redirected`);
});

test("unknown paths under a live WordPress base go to that section, never a 404", () => {
  assert.equal(oneHop("/instructor/someone-new/").final, "/instructors");
  assert.equal(oneHop("/course/old-course").final, "/courses");
  assert.equal(oneHop("/category/news/page/2/").final, "/");
});

test("file-like URLs: Rank Math sitemaps on the public site only; the Apple icon everywhere", () => {
  assert.equal(fileRedirects(false).some((r) => r.destination === "/sitemap.xml"), false);
  const prod = fileRedirects(true);
  for (const s of liveSitemapPaths) assert.ok(prod.some((r) => r.source === s && r.destination === "/sitemap.xml" && r.statusCode === 301), s);
  assert.ok(prod.some((r) => r.destination === "/apple-icon.png"));
});

test("the map is complete: every live content ID has a target", () => {
  const { ids } = legacyRedirectMap();
  for (const [id] of liveContent) assert.ok(ids.has(id), String(id));
  for (const [id] of liveAttachments) assert.ok(ids.has(id), String(id));
});
