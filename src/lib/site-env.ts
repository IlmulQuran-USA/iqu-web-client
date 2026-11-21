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

/** Sent on every response of a non-production build (next.config.ts). */
export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" } as const;
