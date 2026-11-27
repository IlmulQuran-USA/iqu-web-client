/*
 * The preview session (portal Batch 1; plan frontend-portal-admin-plan.md §3.1).
 * Dev only: production never signs one (src/lib/site-env.ts portalAuth).
 *
 * The cookie holds a small JSON payload and its HMAC-SHA256, both base64url:
 *   <payload>.<signature>
 * The HMAC key is derived from PREVIEW_DEFAULT_PASSWORD with a fixed label, so
 * no other secret is needed and changing the password signs everyone out.
 * Web Crypto only (no node: imports), so the proxy, server actions and the
 * unit tests share this one implementation. No imports.
 */

export const ROLES = ["admin", "billing_admin", "teacher", "parent", "student"] as const;
export type Role = (typeof ROLES)[number];

export type Session = {
  /** The account id in the data layer (src/data). */
  sub: string;
  email: string;
  name: string;
  roles: Role[];
  /** Expiry, seconds since the epoch. */
  exp: number;
};

export const SESSION_COOKIE = "iqu_preview_session";
/** Without "Remember me": the browser session, and at most this long. */
export const SESSION_SHORT_S = 12 * 60 * 60;
/** With "Remember me". */
export const SESSION_LONG_S = 30 * 24 * 60 * 60;

const KEY_LABEL = "iqu-preview-session:v1";
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  // Derive the signing key from the secret and a label, so the password itself never signs anything.
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derived = new Uint8Array(await crypto.subtle.sign("HMAC", base, encoder.encode(KEY_LABEL)));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(session)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${base64url(signature)}`;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.sub === "string" &&
    typeof s.email === "string" &&
    typeof s.name === "string" &&
    typeof s.exp === "number" &&
    Array.isArray(s.roles) &&
    s.roles.length > 0 &&
    s.roles.every((r) => (ROLES as readonly unknown[]).includes(r))
  );
}

/** The session, or null when the token is missing, tampered with, malformed or expired. */
export async function verifySession(token: string | undefined, secret: string, nowMs: number = Date.now()): Promise<Session | null> {
  if (!token || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const sig = fromBase64url(signature);
  const body = fromBase64url(payload);
  if (!sig || !body) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig as BufferSource, encoder.encode(payload));
  if (!ok) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }
  if (!isSession(parsed)) return null;
  if (parsed.exp * 1000 <= nowMs) return null;
  return parsed;
}

/** Constant-time comparison of two strings (via their SHA-256 digests, so lengths don't leak). */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
