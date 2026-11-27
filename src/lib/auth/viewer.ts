import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getData } from "../../data/index.ts";
import type { Account } from "../../data/contracts/people.ts";
import { portalAuth, portalEnabled, previewPassword } from "../site-env.ts";
import { AREA_HOME, areasFor, homeFor, type Area } from "./access.ts";
import { CLERK_SESSION_COOKIE, clerkEnv, rolesFromClaims, verifyClerkToken } from "./clerk.ts";
import { SESSION_COOKIE, verifySession } from "./session.ts";

/*
 * The signed-in person (SERVER ONLY). One interface over both providers:
 * the dev preview session (src/lib/auth/session.ts) and Clerk
 * (src/lib/auth/clerk.ts). Pages and server actions use only these
 * functions. The proxy has already turned strangers away (src/proxy.ts);
 * every page checks again here, so a missed proxy rule can never open an area.
 */

export type Viewer = Account;

export async function getViewer(): Promise<Viewer | null> {
  const provider = portalAuth();
  if (!provider) return null;
  const jar = await cookies();
  if (provider === "preview") {
    const session = await verifySession(jar.get(SESSION_COOKIE)?.value, previewPassword() as string);
    if (!session) return null;
    const account = await getData().people.account(session.sub);
    // The account must still exist with the same roles; anything else signs the person out.
    if (!account || account.roles.join() !== session.roles.join()) return null;
    return account;
  }
  const { pem, authorizedParties } = clerkEnv();
  const claims = pem ? await verifyClerkToken(jar.get(CLERK_SESSION_COOKIE)?.value, pem, { authorizedParties }) : null;
  if (!claims) return null;
  const meta = claims.metadata ?? {};
  const roles = rolesFromClaims(claims);
  if (!roles.length) return null;
  const id = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id: claims.sub,
    email: claims.email ?? "",
    name: claims.name ?? claims.email ?? "",
    roles,
    familyId: id(meta.familyId),
    studentId: id(meta.studentId),
    teacherId: id(meta.teacherId),
  };
}

/**
 * The viewer of an area page: 404 when the portal is closed, the sign-in page
 * when signed out, and the person's own home when the area is not theirs.
 */
export async function requireArea(area: Area, path: string = AREA_HOME[area]): Promise<Viewer> {
  // Always per request: a prerender would freeze the signed-out redirect into the page (portal Batch 1 build check).
  await connection();
  if (!portalEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!areasFor(viewer.roles).includes(area)) redirect(homeFor(viewer.roles));
  return viewer;
}
