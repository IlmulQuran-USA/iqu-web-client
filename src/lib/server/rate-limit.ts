import { createHmac, randomBytes } from "node:crypto";

/*
 * A small in-memory rate limit for public form actions (newsletter).
 * SERVER ONLY.
 *
 * The client's IP address is never stored: it is turned into an HMAC with a
 * random key created when the server process starts, so the stored key
 * cannot be traced back to an address, and it changes on every restart.
 * The window lives in this process's memory, so with several server
 * instances each keeps its own count; that is enough to blunt a flood from
 * one address.
 */

const SECRET = randomBytes(32);
const hits = new Map<string, number[]>();

export function clientKey(ip: string): string {
  return createHmac("sha256", SECRET).update(ip).digest("hex");
}

/** True when this key may act now; records the attempt. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map small: drop keys whose attempts have all expired.
  if (hits.size > 5_000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}
