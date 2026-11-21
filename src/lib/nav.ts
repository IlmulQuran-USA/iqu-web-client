/**
 * Whether `href` is the current page or one of its ancestors. The header and
 * drawer share it so both mark the same location. Filter links (with a query
 * string) match their path, e.g. /courses?type=monthly is current on /courses.
 */
export function isCurrent(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Exact page match, used for aria-current="page" on a single link. */
export function isExactPage(pathname: string, href: string): boolean {
  return !href.includes("?") && pathname === href;
}
