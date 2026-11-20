import { NextResponse, type NextRequest } from "next/server";
import { monthlyCourses } from "@/content/pricing";

/**
 * Unknown course slugs get a real 404 on the first request. With
 * cacheComponents the course page streams its shell before notFound() runs,
 * so an unknown slug would otherwise answer 200 once (a soft 404) before the
 * cached 404 takes over. Rewriting to a path no route matches renders the
 * site's not-found page with status 404.
 */
const courseSlugs = new Set<string>(monthlyCourses.map((c) => c.id));

export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/")[2] ?? "";
  if (courseSlugs.has(slug)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_unknown-course", request.url));
}

export const config = { matcher: "/courses/:slug" };
