import { NextResponse, type NextRequest } from "next/server";
import { instructorIds } from "@/content/instructors";
import { monthlyCourses } from "@/content/pricing";
import { COOKIES, locationCode } from "@/lib/consent";
import { legacyHop } from "@/lib/legacy-redirect";
import { wpOrigin } from "@/lib/site-env";

/**
 * Three jobs, on page requests only (/_next, /api and files never come here;
 * a path ending in "/" always does):
 *
 * 1. Redirects (src/lib/legacy-redirect.ts): what stays on WordPress
 *    (/my-billing, the Summer ?iqu_pay= link, /wp-admin, /wp-json) to
 *    WP_ORIGIN on the public site; every live WordPress URL, with
 *    or without its trailing slash, in ONE 301 to its final new page; any
 *    other trailing slash 308s to the path without it, as Next.js does by
 *    default. next.config.ts sets skipTrailingSlashRedirect so the old
 *    "/about/"-style URLs reach this point instead of taking an extra hop.
 * 2. Unknown course and instructor slugs get a real 404 on the first request.
 *    With cacheComponents the page streams its shell before notFound() runs,
 *    so an unknown slug would otherwise answer 200 once (a soft 404) before
 *    the cached 404 takes over. Rewriting to a path no route matches renders
 *    the site's not-found page with status 404.
 * 3. The cookie banner's region (src/lib/consent.ts): Vercel's
 *    x-vercel-ip-country (and, in Canada, x-vercel-ip-country-region for
 *    Québec) is copied into a first-party session cookie, so static pages stay
 *    static and the banner reads it in the browser. No header (local
 *    development) means no cookie, and the banner uses the strictest model.
 *    Only the country code (or "CA-QC") is kept, never the IP.
 */
const known: Record<string, Set<string>> = {
  courses: new Set<string>(monthlyCourses.map((c) => c.id)),
  instructors: new Set<string>(instructorIds),
};

function route(request: NextRequest): NextResponse {
  const hop = legacyHop(request.nextUrl.pathname, request.nextUrl.search, wpOrigin());
  if (hop) return NextResponse.redirect(new URL(hop.location, request.url), hop.status);
  const [, section = "", slug = "", extra] = request.nextUrl.pathname.split("/");
  if (!(section in known) || !slug || extra !== undefined || known[section].has(slug)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_unknown-course", request.url));
}

export function proxy(request: NextRequest) {
  const response = route(request);
  const code = locationCode(request.headers.get("x-vercel-ip-country"), request.headers.get("x-vercel-ip-country-region"));
  if (code && request.cookies.get(COOKIES.country)?.value !== code) {
    response.cookies.set(COOKIES.country, code, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

// Every page path, and every path ending in "/". A last segment with a dot is a file and never reaches the proxy.
export const config = { matcher: ["/((?!_next/|api/|.*\\.[^/]*$).*)"] };
