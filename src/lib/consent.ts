/*
 * Cookie consent: the rules (no DOM at module scope, so the server can import
 * it). The banner is src/components/consent; the copy is src/content/consent.ts.
 *
 * Categories (live Complianz banner, 27 Nov 2026, read-only):
 *   functional   always on: the site itself, the enrollment draft, reCAPTCHA
 *                on the forms, and these consent cookies.
 *   statistics   Google Analytics 4 (G-7QQ7S0EX1T), with Consent Mode v2.
 *   marketing    the Meta Pixel (1756660502407987). The server's Meta
 *                notices (Lead / Conversions API) read the same choice.
 *
 * Model per region (owner, 27 Nov 2026: "hybrid"). Live Complianz has two
 * regions, US and CA, both opt-out, and sends every other country to the US
 * banner. The new site keeps those regions and makes:
 *   statistics   opt-out where the country is known (GA4 runs until the visitor declines),
 *   marketing    opt-in everywhere (the Pixel never runs before "Accept").
 * When the country is unknown (no x-vercel-ip-country), the strictest model:
 * both opt-in. Québec (x-vercel-ip-country-region QC) gets the same strict
 * model; the rest of Canada keeps the Canadian one (owner, 27 Nov 2026). A browser that sends Global Privacy Control is treated as a
 * decline of everything that is not functional, until the visitor chooses.
 *
 * Choices are first-party cookies, kept 365 days (the live Complianz
 * cookie_expiry). Complianz's own cookies count only as a "deny": a live
 * "allow" can come from the opt-out default, not from a choice.
 */

export type Category = "statistics" | "marketing";
export type Basis = "opt-in" | "opt-out";
export type Model = Record<Category, Basis>;
export type Choice = "granted" | "denied";
export type Consent = Choice | "unknown";

export const COOKIES = {
  statistics: "iqu_statistics_consent",
  marketing: "iqu_marketing_consent",
  /** The visitor's country (ISO 3166 alpha-2, or "CA-QC" in Québec), set by src/proxy.ts from Vercel's IP headers. */
  country: "iqu_country",
} as const;

/**
 * The live IDs (27 Nov 2026, read-only): GA4 from Site Kit and GTM-ND5JF9P2;
 * the Pixel from the official-facebook-pixel plugin ("IQU Website Pixel").
 * Loaded directly, without GTM: see F:/iqu-setup/reports/consent-faq.md.
 */
export const TAGS = { ga4: "G-7QQ7S0EX1T", metaPixel: "1756660502407987" } as const;

/** Sent on window by the banner's runtime after the tags are applied (on load and after each choice). */
export const CONSENT_EVENT = "iqu:consent";

/** The live Complianz cookie lifetime: 365 days. */
export const CONSENT_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Live Complianz regions; every other country gets the US model
 * (other_region_behaviour: us). Québec (owner, 27 Nov 2026; Law 25) is the
 * one subdivision with its own model: analytics opt-in there too. The proxy
 * stores "CA-QC" for it (x-vercel-ip-country-region) and only the country
 * code anywhere else.
 */
export type Region = "us" | "ca" | "qc" | "unknown";
const REGION_OF: Record<string, Region> = { US: "us", CA: "ca", "CA-QC": "qc" };
const KNOWN: Model = { statistics: "opt-out", marketing: "opt-in" };
const STRICT: Model = { statistics: "opt-in", marketing: "opt-in" };
const MODELS: Record<Region, Model> = { us: KNOWN, ca: KNOWN, qc: STRICT, unknown: STRICT };

/** The cookie value for a visitor: the country code, or "CA-QC" in Québec. Null when the country is unknown. */
export function locationCode(country: string | null | undefined, region: string | null | undefined): string | null {
  const c = country?.toUpperCase();
  if (!c || !/^[A-Z]{2}$/.test(c)) return null;
  return c === "CA" && region?.toUpperCase() === "QC" ? "CA-QC" : c;
}

export function regionFor(code: string | undefined): Region {
  if (!code || !/^[A-Z]{2}(-QC)?$/.test(code)) return "unknown";
  return REGION_OF[code] ?? "us";
}

export function modelFor(country: string | undefined): Model {
  return MODELS[regionFor(country)];
}

type Get = (name: string) => string | undefined;

/** The visitor's own choice per category, if they made one (or declined on the live site). */
export function storedChoice(get: Get, category: Category): Choice | undefined {
  const own = get(COOKIES[category]);
  if (own === "granted" || own === "denied") return own;
  if (get(`cmplz_${category}`) === "deny") return "denied";
  return undefined;
}

/** True once the visitor chose in this site's banner (Complianz's cookies don't count). */
export function hasChosen(get: Get): boolean {
  return get(COOKIES.statistics) !== undefined || get(COOKIES.marketing) !== undefined;
}

/** What runs now: the stored choice, else the region's default (GPC declines it). */
export function allowed(get: Get, category: Category, gpc = false): boolean {
  const stored = storedChoice(get, category);
  if (stored) return stored === "granted";
  return !gpc && modelFor(get(COOKIES.country))[category] === "opt-out";
}

/**
 * Marketing consent for the server (enrollment record, Meta notices; owner
 * decision 1, 24 Nov 2026). Marketing is opt-in everywhere, so only an
 * explicit "granted" counts; no answer is "unknown", treated as no consent.
 */
export function consentFrom(get: Get): Consent {
  return storedChoice(get, "marketing") ?? "unknown";
}

/** A cookie jar from a Cookie header or document.cookie. */
export function parseCookies(header: string): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try {
      jar.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
    } catch {
      // A malformed value is skipped.
    }
  }
  return jar;
}
