import { NextResponse, type NextRequest } from "next/server";
import { instructorIds } from "@/content/instructors";
import { monthlyCourses } from "@/content/pricing";
import { COOKIES } from "@/lib/consent";

/**
 * Two jobs, on page requests only (files, /_next and /api never come here):
 *
 * 1. Unknown course and instructor slugs get a real 404 on the first request.
 *    With cacheComponents the page streams its shell before notFound() runs,
 *    so an unknown slug would otherwise answer 200 once (a soft 404) before
 *    the cached 404 takes over. Rewriting to a path no route matches renders
 *    the site's not-found page with status 404.
 * 2. The cookie banner's region (src/lib/consent.ts): Vercel's
 *    x-vercel-ip-country is copied into a first-party session cookie, so
 *    static pages stay static and the banner reads the country in the
 *    browser. No header (local development) means no cookie, and the banner
 *    uses the strictest model. Only the 2-letter code is kept, never the IP.
 */
const known: Record<string, Set<string>> = {
  courses: new Set<string>(monthlyCourses.map((c) => c.id)),
  instructors: new Set<string>(instructorIds),
};

function route(request: NextRequest): NextResponse {
  const [, section = "", slug = "", extra] = request.nextUrl.pathname.split("/");
  if (!(section in known) || !slug || extra !== undefined || known[section].has(slug)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_unknown-course", request.url));
}

export function proxy(request: NextRequest) {
  const response = route(request);
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country) && request.cookies.get(COOKIES.country)?.value !== country) {
    response.cookies.set(COOKIES.country, country, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

// Every page path; a last segment with a dot is a file and never reaches the proxy.
export const config = { matcher: ["/((?!_next/|api/|.*\\.[^/]*$).*)"] };
