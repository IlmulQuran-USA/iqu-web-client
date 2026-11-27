import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

/* robots.txt per environment and the sitemap (src/content/sitemap.ts). */
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

const { robotsRules, sitemapEntries } = await import("./sitemap.ts");
const { courses } = await import("./courses.ts");
const { instructors } = await import("./instructors.ts");
const { legacyHop } = await import("../lib/legacy-redirect.ts");
const { NOINDEX_HEADER, siteUrl } = await import("../lib/site-env.ts");

const PROD = "https://ilmulquranus.org";

test("search titles: only for pages in the sitemap, and short enough not to be cut (≤ 60 characters with the site name)", async () => {
  const { searchTitles } = await import("./seo.ts");
  const paths = new Set(sitemapEntries(PROD).map((e) => new URL(e.url).pathname));
  for (const [p, t] of Object.entries(searchTitles)) {
    assert.ok(paths.has(p), `${p} is not a sitemap page`);
    const full = typeof t === "string" ? `${t} · Ilm-Ul-Quran USA` : t.absolute;
    assert.ok(full.length <= 60, `${p}: "${full}" is ${full.length} characters`);
    assert.match(full, /Ilm-Ul-Quran USA/);
  }
});

test("staging robots.txt: Disallow everything, no sitemap; every response also says noindex", () => {
  assert.deepEqual(robotsRules(false, "https://dev.ilmulquranus.org"), { rules: [{ userAgent: "*", disallow: "/" }] });
  assert.deepEqual(NOINDEX_HEADER, { key: "X-Robots-Tag", value: "noindex, nofollow" });
});

test("production robots.txt: allow, keep the tools, the API and the portal out, point at the sitemap on the real domain", () => {
  const r = robotsRules(true, siteUrl(undefined, "production").origin);
  assert.deepEqual(r.rules, [
    { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/preview/", "/login", "/forgot-password", "/a/", "/p/", "/s/", "/t/"] },
  ]);
  assert.equal(r.sitemap, `${PROD}/sitemap.xml`);
});

test("the canonical origin is the real domain on the public site, whatever the deployment URL", () => {
  assert.equal(siteUrl(undefined, "production").origin, PROD);
  assert.equal(siteUrl("https://ilmulquranus.org/", "production").origin, PROD);
});

test("sitemap: only built, indexable pages, each once, on the real domain, with a lastmod date", () => {
  const entries = sitemapEntries(PROD);
  const urls = entries.map((e) => e.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const e of entries) {
    assert.ok(e.url.startsWith(`${PROD}/`), e.url);
    assert.match(e.lastModified, /^\d{4}-\d{2}-\d{2}$/, e.url);
    // Never a redirect source: each URL is served as it is.
    assert.equal(legacyHop(new URL(e.url).pathname), null, e.url);
  }
  const paths = new Set(urls.map((u) => new URL(u).pathname));
  for (const p of ["/", "/courses", "/instructors", "/about", "/donate", "/scholarship", "/faq", "/contact", "/enroll", "/legal/privacy", "/legal/terms", "/legal/refund", "/programs/weekend-ilm-program", "/programs/summer-ilm-camp", "/courses/quran-hifz"]) {
    assert.ok(paths.has(p), `missing ${p}`);
  }
  // Kept out, as on the live site or because they are not pages.
  for (const c of courses.filter((c) => c.content.noindex)) assert.ok(!paths.has(c.href), c.href);
  for (const p of instructors.filter((p) => p.noindex)) assert.ok(!paths.has(`/instructors/${p.id}`), p.id);
  for (const p of ["/enroll/confirmation", "/dev/components", "/preview/sample-report"]) assert.ok(!paths.has(p), p);
  assert.equal(entries.filter((e) => e.url.includes("/instructors/")).length, instructors.filter((p) => !p.noindex).length);
});
