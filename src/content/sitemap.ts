import { courses } from "./courses.ts";
import { instructors } from "./instructors.ts";
import { accessibilityStatement, privacyPolicy, refundPolicy, termsAndConditions } from "./legal.ts";
import { builtOnly } from "./planned-pages.ts";
import { programs } from "./pricing.ts";
import { routeDates } from "./sitemap-dates.ts";

/*
 * The sitemap and robots rules (owner, 27 Nov 2026). Pure, so tests check
 * them per environment; src/app/sitemap.ts and src/app/robots.ts serve them.
 *
 * Sitemap: only built pages that are indexable. Left out, as on the live site
 * or because they are not pages: the enroll confirmation, a course or teacher
 * marked noindex (Islamic Studies until its content is live; Hafezah Humayra
 * Afrin, noindex on live), the 404 and the /dev and /preview tools.
 * <lastmod> is the last commit that changed the route (src/content/sitemap-dates.ts).
 */

export type SitemapEntry = { url: string; lastModified: string };

const STATIC_ROUTES = ["/", "/courses", "/instructors", "/about", "/donate", "/scholarship", "/faq", "/contact", "/enroll"] as const;

export function sitemapEntries(origin: string): SitemapEntry[] {
  const at = (path: string, dateKey: string) => ({ url: new URL(path, origin).toString(), lastModified: routeDates[dateKey] });
  return [
    ...builtOnly(STATIC_ROUTES.map((href) => ({ href }))).map(({ href }) => at(href, href)),
    ...courses.filter((c) => !c.content.noindex).map((c) => at(c.href, "/courses/*")),
    ...Object.values(programs).map((p) => at(p.href, "/programs/*")),
    ...instructors.filter((p) => !p.noindex).map((p) => at(`/instructors/${p.id}`, "/instructors/*")),
    ...[privacyPolicy, termsAndConditions, refundPolicy, accessibilityStatement].map((d) => at(d.path, "/legal/*")),
  ];
}

/**
 * robots.txt. Staging (dev.ilmulquranus.org, previews): nothing may be
 * crawled (owner, 27 Nov 2026), on top of the noindex meta tag and the
 * X-Robots-Tag header on every response. Public site: everything but the
 * internal tools and the API, and the sitemap.
 */
export function robotsRules(production: boolean, origin: string) {
  if (!production) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/preview/"] }],
    sitemap: new URL("/sitemap.xml", origin).toString(),
  };
}
