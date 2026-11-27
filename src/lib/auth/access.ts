import type { Role, Session } from "./session.ts";

/*
 * Who may open which portal path (plan frontend-portal-admin-plan.md §3.2;
 * owner, 27 Nov 2026: "each role sees only its own area; others → their own
 * home"). Pure, so the proxy, the pages and the tests share it.
 *
 *   portal closed (portalEnabled false)  every portal path → 404
 *   /login, /forgot-password             signed in → the role's home
 *   /a /p /s /t (and below)              signed out → /login?next=…;
 *                                        another role's area → own home
 */

export type Area = "a" | "p" | "s" | "t";

/** The role that owns each area. */
export const AREA_ROLE: Record<Area, Role> = { a: "admin", p: "parent", s: "student", t: "teacher" };

/** Each area's home (its landing screen). */
export const AREA_HOME: Record<Area, string> = { a: "/a/live", p: "/p/overview", s: "/s/overview", t: "/t/today" };

/** The sign-in pages. */
export const AUTH_PATHS = ["/login", "/forgot-password"] as const;

/** Guarded with the portal: the old parent-dashboard preview (owner, 27 Nov 2026). */
const GUARDED_PREVIEW = /^\/preview\/parent-dashboard(\/|$)/;

export function areaOf(pathname: string): Area | null {
  const m = /^\/([apst])(\/|$)/.exec(pathname);
  return m ? (m[1] as Area) : null;
}

export function isAuthPath(pathname: string): boolean {
  return (AUTH_PATHS as readonly string[]).includes(pathname.replace(/\/$/, "") || "/");
}

/** Every path the portal guard covers. */
export function isPortalPath(pathname: string): boolean {
  return areaOf(pathname) !== null || isAuthPath(pathname) || GUARDED_PREVIEW.test(pathname);
}

/** The areas a set of roles may open. A billing admin is also an admin in this app (two roles on one account). */
export function areasFor(roles: readonly Role[]): Area[] {
  return (Object.keys(AREA_ROLE) as Area[]).filter((area) => roles.includes(AREA_ROLE[area]));
}

/** Where a signed-in person lands: admin, then teacher, then parent, then student. */
export function homeFor(roles: readonly Role[]): string {
  for (const area of ["a", "t", "p", "s"] as const) if (roles.includes(AREA_ROLE[area])) return AREA_HOME[area];
  return "/login";
}

/** A ?next= target is followed only to a path this person may open; anything else goes home. */
export function safeNext(next: string | null | undefined, roles: readonly Role[]): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return homeFor(roles);
  const area = areaOf(next.split(/[?#]/)[0]);
  return area && areasFor(roles).includes(area) ? next : homeFor(roles);
}

export type Decision = { action: "next" } | { action: "notFound" } | { action: "redirect"; to: string };

export function decideAccess({
  pathname,
  search = "",
  enabled,
  session,
}: {
  pathname: string;
  search?: string;
  enabled: boolean;
  session: Pick<Session, "roles"> | null;
}): Decision {
  if (!isPortalPath(pathname)) return { action: "next" };
  if (!enabled) return { action: "notFound" };
  if (GUARDED_PREVIEW.test(pathname)) return { action: "next" };
  if (isAuthPath(pathname)) return session ? { action: "redirect", to: homeFor(session.roles) } : { action: "next" };

  const area = areaOf(pathname) as Area;
  if (!session) return { action: "redirect", to: `/login?next=${encodeURIComponent(pathname + search)}` };
  if (!areasFor(session.roles).includes(area)) return { action: "redirect", to: homeFor(session.roles) };
  // The bare area path lands on that area's home.
  if (pathname === `/${area}` || pathname === `/${area}/`) return { action: "redirect", to: AREA_HOME[area] };
  return { action: "next" };
}
