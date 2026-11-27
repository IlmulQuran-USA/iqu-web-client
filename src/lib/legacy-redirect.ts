import { legacyRedirectMap } from "../content/legacy-paths.ts";

/*
 * What the proxy answers for a path before any page renders (src/proxy.ts).
 * Pure, so tests can run every live URL through it.
 *
 * - A live WordPress URL (src/content/legacy-paths.ts), with or without its
 *   trailing slash, or as /?p= / /?page_id= / /?attachment_id=: ONE 301 to its
 *   final new page. The WordPress query keys are dropped; anything else in the
 *   query (utm_*, fbclid) is kept.
 * - Any other path under a live WordPress namespace (/instructor/…, /course/…,
 *   the taxonomy, category and author bases, /feed/…): 301 to that section's
 *   page, so an old link never ends on a 404.
 * - Any other path with a trailing slash: 308 to the path without it, exactly
 *   what Next.js does by default (next.config.ts sets skipTrailingSlashRedirect
 *   so the proxy can see legacy slashes first).
 * - Everything else: null (no redirect).
 */

export type Hop = { status: 301 | 308; location: string } | null;

const WP_KEYS = ["p", "page_id", "attachment_id"];

/** Unknown paths under a live WordPress base go to the closest section page. */
const NAMESPACES: [RegExp, string][] = [
  [/^\/instructor(\/|$)/, "/instructors"],
  [/^\/course(\/|$)/, "/courses"],
  [/^\/ilm_ul_quran_course_cats(\/|$)/, "/courses"],
  [/^\/iq_instructor_cats(\/|$)/, "/instructors"],
  [/^\/(category|tag|author)(\/|$)/, "/"],
  [/^\/(feed|comments\/feed)(\/|$)/, "/"],
];

function keep(search: string): string {
  const params = new URLSearchParams(search);
  for (const k of WP_KEYS) params.delete(k);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

export function legacyHop(pathname: string, search = ""): Hop {
  const { paths, ids } = legacyRedirectMap();
  const hadSlash = pathname.length > 1 && pathname.endsWith("/");
  const path = hadSlash ? pathname.replace(/\/+$/, "") || "/" : pathname;

  if (path === "/" && search) {
    const params = new URLSearchParams(search);
    for (const key of WP_KEYS) {
      const id = Number(params.get(key));
      if (id && ids.has(id)) return { status: 301, location: ids.get(id)! + keep(search) };
    }
  }

  const known = paths.get(path) ?? paths.get(path.toLowerCase());
  if (known !== undefined) {
    // A live URL whose new address is the same path: only its trailing slash changes.
    if (known === path && !hadSlash) return null;
    return { status: 301, location: known + keep(search) };
  }
  for (const [re, to] of NAMESPACES) if (re.test(path)) return { status: 301, location: to + keep(search) };
  if (hadSlash) return { status: 308, location: path + search };
  return null;
}
