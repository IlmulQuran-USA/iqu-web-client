import { NextResponse, type NextRequest } from "next/server";
import { instructorIds } from "@/content/instructors";
import { monthlyCourses } from "@/content/pricing";

/**
 * Unknown course and instructor slugs get a real 404 on the first request.
 * With cacheComponents the page streams its shell before notFound() runs,
 * so an unknown slug would otherwise answer 200 once (a soft 404) before the
 * cached 404 takes over. Rewriting to a path no route matches renders the
 * site's not-found page with status 404.
 */
const known: Record<string, Set<string>> = {
  courses: new Set<string>(monthlyCourses.map((c) => c.id)),
  instructors: new Set<string>(instructorIds),
};

export function proxy(request: NextRequest) {
  const [, section = "", slug = ""] = request.nextUrl.pathname.split("/");
  // Files (the portraits in public/instructors/*.webp) are never pages: pass them through.
  if (slug.includes(".") || known[section]?.has(slug)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_unknown-course", request.url));
}

// Page paths only: a segment with a dot is a file and never reaches the proxy.
export const config = { matcher: ["/courses/:slug([^./]+)", "/instructors/:slug([^./]+)"] };
