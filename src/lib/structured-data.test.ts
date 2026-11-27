import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
 * JSON-LD shapes (src/lib/structured-data.ts), built from the real content.
 * The public site's origin: NEXT_PUBLIC_SITE_ENV=production, no SITE_URL
 * override, so every URL must be https://ilmulquranus.org/…
 */
process.env.NEXT_PUBLIC_SITE_ENV = "production";
delete process.env.NEXT_PUBLIC_SITE_URL;

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

const ld = await import("./structured-data.ts");
const { site } = await import("../content/site.ts");
const { courses } = await import("../content/courses.ts");
const { fromPrice, programs } = await import("../content/pricing.ts");
const { instructors } = await import("../content/instructors.ts");
const { faqEntries } = await import("../content/faq.ts");

const ORIGIN = "https://ilmulquranus.org";

/** Every string that looks like a URL in the object. */
function urls(value: unknown): string[] {
  if (typeof value === "string") return /^https?:\/\//.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(urls);
  if (value && typeof value === "object") return Object.values(value).flatMap(urls);
  return [];
}

function common(doc: Record<string, unknown>) {
  assert.equal(doc["@context"], "https://schema.org");
  assert.ok(doc["@type"]);
  for (const u of urls(doc)) {
    if (u === "https://schema.org") continue;
    assert.ok(u.startsWith(`${ORIGIN}/`) || /facebook\.com/.test(u), `URL not on the real domain: ${u}`);
  }
  // Round-trips as JSON and the script body can't close its element.
  assert.deepEqual(JSON.parse(ld.jsonLdHtml(doc as never)), JSON.parse(JSON.stringify(doc)));
  assert.doesNotMatch(ld.jsonLdHtml({ "@context": "https://schema.org", "@type": "Thing", name: "</script>" }), /<\/script>/);
}

test("EducationalOrganization + NGO: the real facts (PRODUCT.md 'Name and entity')", () => {
  const org = ld.organizationLd(["https://www.facebook.com/ilmulquranusa"]);
  common(org);
  assert.deepEqual(org["@type"], ["EducationalOrganization", "NGO"]);
  assert.equal(org["@id"], `${ORIGIN}/#organization`);
  assert.equal(org.name, "Ilm-Ul-Quran USA");
  assert.equal(org.legalName, "AL HASANAH FOUNDATION");
  assert.equal(org.taxID, "93-3902300");
  assert.equal(org.nonprofitStatus, "Nonprofit501c3");
  assert.equal(org.url, `${ORIGIN}/`);
  assert.deepEqual(org.address, {
    "@type": "PostalAddress",
    streetAddress: "100 N Central Expy Suite 914",
    addressLocality: "Richardson",
    addressRegion: "TX",
    postalCode: "75080",
    addressCountry: "US",
  });
  assert.deepEqual((org.areaServed as { name: string }[]).map((a) => a.name), ["United States", "Canada"]);
  assert.equal(org.telephone, site.phone?.href.replace("tel:", ""));
});

test("Course on every course and program page: name, description, provider → the organisation, an Offer in USD", () => {
  const all = [
    ...courses.map((c) => ld.courseLd({ name: c.label, description: `${c.label} description`, path: c.href, price: fromPrice(c) })),
    ...Object.values(programs).map((p) => ld.courseLd({ name: p.label, description: `${p.label} description`, path: p.href, price: p.fee, free: p.fee === 0 })),
  ];
  assert.equal(all.length, courses.length + Object.keys(programs).length);
  for (const c of all) {
    common(c);
    assert.equal(c["@type"], "Course");
    assert.ok(typeof c.name === "string" && c.name.length > 0);
    assert.ok(typeof c.description === "string" && c.description.length > 0);
    assert.equal((c.provider as { "@id": string })["@id"], `${ORIGIN}/#organization`);
    const offer = c.offers as { "@type": string; price: number; priceCurrency: string; category: string };
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.priceCurrency, "USD");
    assert.ok(Number.isFinite(offer.price) && offer.price >= 0);
    assert.equal(offer.category, offer.price === 0 ? "Free" : "Paid");
    assert.equal((c.hasCourseInstance as { courseMode: string }).courseMode, "Online");
    assert.ok(!("aggregateRating" in c), "no ratings: there are no reviews");
  }
});

test("Person on every instructor page: name, job, URL, worksFor → the organisation", () => {
  for (const p of instructors) {
    const doc = ld.personLd({ name: p.name, jobTitle: "Teacher", path: `/instructors/${p.id}`, languages: p.languages, image: p.photo?.src, knowsAbout: [] });
    common(doc);
    assert.equal(doc["@type"], "Person");
    assert.equal(doc.name, p.name);
    assert.equal(doc.url, `${ORIGIN}/instructors/${p.id}`);
    assert.equal((doc.worksFor as { "@id": string })["@id"], `${ORIGIN}/#organization`);
    assert.ok(Array.isArray(doc.knowsLanguage) && (doc.knowsLanguage as string[]).length > 0);
  }
});

test("BreadcrumbList: positions 1…n, every linked crumb an absolute URL, the current page last", () => {
  const doc = ld.breadcrumbLd([{ label: "Home", href: "/" }, { label: "Courses", href: "/courses" }, { label: "Quran Hifz" }]);
  common(doc);
  const items = doc.itemListElement as { "@type": string; position: number; name: string; item?: string }[];
  assert.deepEqual(items.map((i) => i.position), [1, 2, 3]);
  assert.deepEqual(items.map((i) => i.item), [`${ORIGIN}/`, `${ORIGIN}/courses`, undefined]);
  assert.ok(items.every((i) => i["@type"] === "ListItem" && i.name));
});

test("FAQPage: every question with a non-empty plain-text answer", () => {
  const doc = ld.faqPageLd(faqEntries.map((e) => ({ q: e.q, text: e.a })));
  common(doc);
  const qs = doc.mainEntity as { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
  assert.equal(qs.length, faqEntries.length);
  for (const q of qs) {
    assert.equal(q["@type"], "Question");
    assert.equal(q.acceptedAnswer["@type"], "Answer");
    assert.ok(q.name && q.acceptedAnswer.text);
  }
});

test("ItemList: positions and absolute URLs", () => {
  const doc = ld.itemListLd("Courses", [{ name: "A", path: "/courses/a" }, { name: "B", path: "/courses/b", item: { "@type": "Person", name: "B" } }]);
  common(doc);
  const items = doc.itemListElement as { position: number; url?: string; item?: { url: string } }[];
  assert.deepEqual(items.map((i) => i.position), [1, 2]);
  assert.equal(items[0].url, `${ORIGIN}/courses/a`);
  assert.equal(items[1].item?.url, `${ORIGIN}/courses/b`);
});
