import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Request signing for the server-to-server call to the iqu-registration
 * plugin (enroll-architecture.md Option A; contract in
 * F:/iqu-setup/reports/enroll-plugin-changes.md, "Authentication").
 *
 *   X-IQU-Timestamp: <unix seconds>
 *   X-IQU-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>
 *
 * The plugin recomputes the same HMAC over the raw bytes it received, compares
 * in constant time and refuses a timestamp more than 300 s away from its clock.
 * SERVER ONLY: the secret never reaches the browser.
 */

export const SIGNATURE_VERSION = "v1";
export const MAX_SKEW_SECONDS = 300;

export function signature(secret: string, timestamp: number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function signedHeaders(secret: string, rawBody: string, now = Date.now()): Record<string, string> {
  const timestamp = Math.floor(now / 1000);
  return {
    "X-IQU-Timestamp": String(timestamp),
    "X-IQU-Signature": `${SIGNATURE_VERSION}=${signature(secret, timestamp, rawBody)}`,
  };
}

/** The plugin side of the check, mirrored here so the contract has a test. */
export function verifySignature(secret: string, header: string, timestamp: string, rawBody: string, now = Date.now()): boolean {
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(Math.floor(now / 1000) - ts) > MAX_SKEW_SECONDS) return false;
  const [version, hex] = header.split("=", 2);
  if (version !== SIGNATURE_VERSION || !/^[a-f0-9]{64}$/.test(hex ?? "")) return false;
  const expected = Buffer.from(signature(secret, ts, rawBody), "hex");
  return timingSafeEqual(expected, Buffer.from(hex, "hex"));
}

/** A stable, non-reversible key for an IP address (rate limits in the plugin). The IP itself is never sent for storage. */
export function ipHash(secret: string, ip: string): string {
  return createHmac("sha256", secret).update(`ip|${ip}`).digest("hex").slice(0, 32);
}
