import { ROLES, type Role } from "./session.ts";

/*
 * The Clerk adapter, ready for when the keys exist (owner, 27 Nov 2026; plan
 * frontend-portal-admin-plan.md §3.1). Not active today: there are no Clerk
 * keys, so src/lib/site-env.ts portalAuth() never picks it.
 *
 * Verification is networkless, as Clerk documents for backends: the
 * `__session` cookie is an RS256 JWT, checked against the instance's PEM
 * public key in CLERK_JWT_KEY, its expiry and not-before times, and (when
 * set) the authorized party in CLERK_AUTHORIZED_PARTIES. Roles and record ids
 * come from the session token's custom claim `metadata`, which the Clerk
 * dashboard must define as {{user.public_metadata}}:
 *   { "roles": ["parent"], "familyId": "…", "studentId": "…", "teacherId": "…" }
 * The users themselves are created by scripts/preview-users.mjs (Backend API).
 *
 * Still to do when the keys arrive (it cannot be tested before): install
 * @clerk/nextjs for the themed <SignIn> and the reset and verify flows on
 * /login (appearance mapped to our CSS variables), and measure the portal
 * budget again with Clerk's script on the page.
 */

export const CLERK_SESSION_COOKIE = "__session";

export type ClerkClaims = {
  sub: string;
  exp: number;
  nbf?: number;
  azp?: string;
  email?: string;
  name?: string;
  metadata?: { roles?: unknown; familyId?: unknown; studentId?: unknown; teacherId?: unknown };
};

function b64urlToBytes(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s+/g, "");
  return crypto.subtle.importKey("spki", b64urlToBytes(body.replace(/\+/g, "-").replace(/\//g, "_")) as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

/** The verified claims of a Clerk session token, or null. */
export async function verifyClerkToken(
  token: string | undefined,
  pem: string,
  { nowMs = Date.now(), authorizedParties = [] as string[] } = {},
): Promise<ClerkClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    if (header.alg !== "RS256") return null;
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      await importKey(pem),
      b64urlToBytes(parts[2]) as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as ClerkClaims;
    const now = nowMs / 1000;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number" || claims.exp <= now) return null;
    if (typeof claims.nbf === "number" && claims.nbf > now + 5) return null;
    if (authorizedParties.length && claims.azp && !authorizedParties.includes(claims.azp)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** The portal roles in the token's metadata claim; unknown values are dropped. */
export function rolesFromClaims(claims: ClerkClaims): Role[] {
  const raw = claims.metadata?.roles;
  return Array.isArray(raw) ? raw.filter((r): r is Role => (ROLES as readonly unknown[]).includes(r)) : [];
}

export function clerkEnv(env: Record<string, string | undefined> = process.env) {
  return {
    pem: env.CLERK_JWT_KEY?.trim() ?? "",
    authorizedParties: (env.CLERK_AUTHORIZED_PARTIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}
