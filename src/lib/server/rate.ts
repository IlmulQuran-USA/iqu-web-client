import { and, eq, sql } from "drizzle-orm";
import { rateLimits } from "../../db/schema.ts";
import type { Queryable } from "../../db/types.ts";

/*
 * Rate limits in Postgres (architecture §1.1: no Redis at this volume).
 * Fixed one-hour windows per key; keys are HMACs from ./keys.ts, never an
 * IP or an email (the table's CHECK refuses anything else).
 *
 * The plugin's numbers (includes/class-iqu-submit-guard.php:22-23, 80-101;
 * public/class-iqu-form.php:1157-1279):
 *   enrollments  15 per IP and 8 per email an hour, counted only on success
 *   coupon Apply 20 per IP an hour; 100 failed codes an hour site-wide pause the check
 *   waitlist     5 per IP an hour
 */

export const LIMITS = {
  enrollIp: 15,
  enrollEmail: 8,
  couponIp: 20,
  couponFailuresSiteWide: 100,
  waitlistIp: 5,
  // /contact (no plugin equivalent; the live page had no working form): 5 per IP and 3 per email an hour, counted on success.
  contactIp: 5,
  contactEmail: 3,
  // /teach (no plugin equivalent; the live page had no form): 3 per IP and 2 per email an hour, counted on success.
  teachIp: 3,
  teachEmail: 2,
} as const;

export function windowStart(now: Date): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export async function hits(db: Queryable, key: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart(now))));
  return row?.count ?? 0;
}

export async function bump(db: Queryable, key: string, now: Date): Promise<void> {
  await db
    .insert(rateLimits)
    .values({ key, windowStart: windowStart(now), count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } });
}

/** True when the key is still under `limit` this hour. */
export async function under(db: Queryable, key: string, limit: number, now: Date): Promise<boolean> {
  return (await hits(db, key, now)) < limit;
}
