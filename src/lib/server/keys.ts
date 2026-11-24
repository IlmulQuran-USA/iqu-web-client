import { createHmac } from "node:crypto";

/*
 * Keyed hashes for rate limits (architecture §2.1 step 5). SERVER ONLY.
 *
 * An IP address or an email never reaches the database: only
 * "<kind>:<32 hex>" = HMAC-SHA256(IQU_HASH_SECRET, kind|value). The
 * rate_limits table refuses anything else (CHECK rate_limits_key_hashed).
 */

export function hashKey(secret: string, kind: string, value: string): string {
  if (!/^[a-z]+$/.test(kind)) throw new Error(`Bad key kind: ${kind}`);
  return `${kind}:${createHmac("sha256", secret).update(`${kind}|${value}`).digest("hex").slice(0, 32)}`;
}

/**
 * The visitor's own IP from the request headers, or "" when there is none.
 * Only the headers Vercel's edge sets itself (x-vercel-forwarded-for, then
 * x-real-ip) are read: as in the plugin (public/class-iqu-form.php:1269-1278),
 * a header the visitor can write on their own is never trusted. An empty
 * answer means "no IP rule" for this request (local development), never a
 * key shared by everyone.
 */
export function clientIp(get: (name: string) => string | null | undefined): string {
  for (const name of ["x-vercel-forwarded-for", "x-real-ip"]) {
    const first = (get(name) ?? "").split(",")[0]?.trim() ?? "";
    if (first && first.length <= 64 && /^[0-9a-fA-F:.]+$/.test(first)) return first;
  }
  return "";
}
