/**
 * Which site this build is: the public site, or a copy that search engines
 * must never index (dev.ilmulquranus.org and every pull-request preview).
 *
 * Only the exact value "production" counts as the public site. A missing,
 * empty or misspelt NEXT_PUBLIC_SITE_ENV is staging, so a misconfigured
 * deployment can never expose staging to search engines. See DEPLOYMENT.md.
 *
 * Imported by next.config.ts, so this module must stay free of imports.
 */
export type SiteEnv = "staging" | "production";

export function siteEnv(value: string | undefined = process.env.NEXT_PUBLIC_SITE_ENV): SiteEnv {
  return value === "production" ? "production" : "staging";
}

export function isProductionSite(value: string | undefined = process.env.NEXT_PUBLIC_SITE_ENV): boolean {
  return siteEnv(value) === "production";
}

/**
 * Where WordPress lives after the domain switch (owner, 27 Nov 2026:
 * wp.ilmulquranus.org), read from WP_ORIGIN. Only on the public site, only an
 * https origin, and never the site's own: anything else is null, and then no
 * request is sent to WordPress. Used for the uploads, /my-billing, the Summer
 * ?iqu_pay= link and the WordPress admin (src/lib/legacy-redirect.ts,
 * next.config.ts; F:/iqu-setup/reports/cutover-runbook.md).
 */
export function wpOrigin(value: string | undefined = process.env.WP_ORIGIN, env: string | undefined = process.env.NEXT_PUBLIC_SITE_ENV): string | null {
  if (!isProductionSite(env)) return null;
  try {
    const url = new URL((value ?? "").trim());
    if (url.protocol !== "https:" || url.origin === SITE_URLS.production || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Sent on every response of a non-production build (next.config.ts). */
export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" } as const;

const SITE_URLS = { production: "https://ilmulquranus.org", staging: "https://dev.ilmulquranus.org" } as const;

/**
 * The site's origin, used as metadataBase for canonical and Open Graph URLs.
 * Reads NEXT_PUBLIC_SITE_URL (set in Vercel; read at build time). If it is
 * missing or not an http(s) URL, falls back to the origin for this site
 * environment, so a staging build never points canonicals at production.
 */
export function siteUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  env: string | undefined = process.env.NEXT_PUBLIC_SITE_ENV,
): URL {
  try {
    const url = new URL((value ?? "").trim());
    if (url.protocol === "https:" || url.protocol === "http:") return new URL(url.origin);
  } catch {
    // fall through to the default
  }
  return new URL(SITE_URLS[siteEnv(env)]);
}
