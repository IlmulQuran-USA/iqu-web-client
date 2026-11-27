import assert from "node:assert/strict";
import { test } from "node:test";
import { allowed, CONSENT_MAX_AGE, consentFrom, COOKIES, hasChosen, locationCode, modelFor, parseCookies, regionFor, storedChoice, TAGS } from "./consent.ts";

const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];

test("regions as live Complianz: US and CA, every other country gets the US model; no country is the strictest", () => {
  assert.equal(regionFor("US"), "us");
  assert.equal(regionFor("CA"), "ca");
  assert.equal(regionFor("BD"), "us");
  assert.equal(regionFor("GB"), "us");
  assert.equal(regionFor(undefined), "unknown");
  assert.equal(regionFor("usa"), "unknown");
  // Owner, 27 Nov 2026 ("hybrid"): statistics opt-out where the country is known, marketing opt-in everywhere.
  for (const c of ["US", "CA", "BD"]) assert.deepEqual(modelFor(c), { statistics: "opt-out", marketing: "opt-in" });
  assert.deepEqual(modelFor(undefined), { statistics: "opt-in", marketing: "opt-in" });
});

test("Québec (x-vercel-ip-country-region QC): analytics opt-in; the rest of Canada unchanged", () => {
  // What the proxy stores: the country code, or "CA-QC" in Québec only.
  assert.equal(locationCode("CA", "QC"), "CA-QC");
  assert.equal(locationCode("ca", "qc"), "CA-QC");
  assert.equal(locationCode("CA", "ON"), "CA");
  assert.equal(locationCode("CA", null), "CA");
  assert.equal(locationCode("US", "QC"), "US"); // "QC" means Québec only in Canada
  assert.equal(locationCode(null, "QC"), null);
  assert.equal(locationCode("XYZ", null), null);
  assert.equal(regionFor("CA-QC"), "qc");
  assert.equal(regionFor("US-QC"), "us"); // never stored; read as the country
  assert.equal(regionFor("CA-ON"), "unknown"); // never stored; not a shape the proxy writes
  assert.deepEqual(modelFor("CA-QC"), { statistics: "opt-in", marketing: "opt-in" });
  assert.equal(allowed(jar({ iqu_country: "CA-QC" }), "statistics"), false);
  assert.equal(allowed(jar({ iqu_country: "CA" }), "statistics"), true);
  // An explicit choice still wins in Québec.
  assert.equal(allowed(jar({ iqu_country: "CA-QC", iqu_statistics_consent: "granted" }), "statistics"), true);
});

test("before any choice: GA4 runs in known countries, never the Pixel; nothing when the country is unknown", () => {
  assert.equal(allowed(jar({ iqu_country: "US" }), "statistics"), true);
  assert.equal(allowed(jar({ iqu_country: "CA" }), "marketing"), false);
  assert.equal(allowed(jar({}), "statistics"), false);
  assert.equal(allowed(jar({}), "marketing"), false);
  // Global Privacy Control declines the opt-out default.
  assert.equal(allowed(jar({ iqu_country: "US" }), "statistics", true), false);
});

test("a stored choice wins over the region default, and GPC never overrides an explicit choice", () => {
  const get = jar({ iqu_country: "US", iqu_statistics_consent: "denied", iqu_marketing_consent: "granted" });
  assert.equal(allowed(get, "statistics"), false);
  assert.equal(allowed(get, "marketing", true), true);
  assert.equal(hasChosen(get), true);
  assert.equal(hasChosen(jar({ iqu_country: "US" })), false);
});

test("live Complianz cookies: a deny is kept, an allow is not consent (it can be the opt-out default)", () => {
  assert.equal(storedChoice(jar({ cmplz_marketing: "deny" }), "marketing"), "denied");
  assert.equal(storedChoice(jar({ cmplz_marketing: "allow" }), "marketing"), undefined);
  assert.equal(allowed(jar({ iqu_country: "US", cmplz_statistics: "deny" }), "statistics"), false);
  // Complianz cookies alone still show the new banner.
  assert.equal(hasChosen(jar({ cmplz_marketing: "deny" })), false);
});

test("the server's marketing flag (enrollment record, Meta notices) reads the banner's cookie", () => {
  assert.equal(consentFrom(jar({ [COOKIES.marketing]: "granted" })), "granted");
  assert.equal(consentFrom(jar({ [COOKIES.marketing]: "denied" })), "denied");
  assert.equal(consentFrom(jar({ cmplz_marketing: "allow" })), "unknown");
  assert.equal(consentFrom(jar({})), "unknown");
});

test("both footers say 'Cookie settings' and reopen the dialog", async () => {
  const { readFileSync } = await import("node:fs");
  const { consentCopy } = await import("../content/consent.ts");
  assert.equal(consentCopy.footerLink, "Cookie settings");
  const frame = readFileSync(new URL("../components/enroll/frame.tsx", import.meta.url), "utf8");
  assert.match(frame, /data-consent-open=""[^>]*>\s*Cookie settings\s*</);
  const footer = readFileSync(new URL("../components/layout/Footer.tsx", import.meta.url), "utf8");
  assert.match(footer, /data-consent-open=""/);
});

test("the banner markup in the root layout imports no client module (js-budget: it regrouped every page's chunks)", async () => {
  const { readFileSync } = await import("node:fs");
  const banner = readFileSync(new URL("../components/consent/ConsentBanner.tsx", import.meta.url), "utf8");
  const imports = [...banner.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["@/content/consent"]);
  assert.doesNotMatch(banner, /"use client"/);
});

test("cookie parsing, lifetime and the live IDs", () => {
  const c = parseCookies("a=1; iqu_marketing_consent=granted; bad=%E0%A4%A; empty=");
  assert.equal(c.get("iqu_marketing_consent"), "granted");
  assert.equal(c.has("bad"), false);
  assert.equal(c.get("empty"), "");
  assert.equal(CONSENT_MAX_AGE, 365 * 86400);
  assert.deepEqual(TAGS, { ga4: "G-7QQ7S0EX1T", metaPixel: "1756660502407987" });
});
