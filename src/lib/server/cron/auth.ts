import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The CRON_SECRET check for every /api/cron/* route (Vercel Cron sends
 * "Authorization: Bearer $CRON_SECRET"). Both sides are hashed before the
 * constant-time compare, so neither the length nor any prefix of the secret
 * leaks through timing. A missing or short secret (under 16 characters)
 * refuses every call.
 */
export function cronAuthorized(header: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  const s = secret?.trim() ?? "";
  if (s.length < 16) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${s}`));
}
