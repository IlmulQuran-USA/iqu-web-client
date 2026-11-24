import type { Queryable } from "../../../db/types.ts";
import { hashKey } from "../keys.ts";
import { enqueue } from "../outbox/outbox.ts";
import { bump, hits, LIMITS, windowStart } from "../rate.ts";
import { composeTelegram } from "./messages.ts";

/*
 * Coupon guessing guard, shared by "Apply" and the submit (port of
 * public/class-iqu-form.php:1231-1267). Per IP: 20 tries an hour. Site-wide:
 * 100 wrong codes in one hour pauses the check for the rest of the hour, and
 * the team is told once (Telegram "⚠️ Coupon check paused"). A request that
 * fails reCAPTCHA counts as a try for its IP but never as a site-wide
 * failure, so bots cannot pause the check for everyone.
 */

export const GUARD_MESSAGES = {
  tooMany: "Too many attempts. Please wait a while and try again, or contact us for help.",
  paused: "Coupon check is busy right now. Please try again in an hour, or contact us for help.",
} as const;

const siteKey = (secret: string) => hashKey(secret, "couponfail", "site");

/** A message when the check must not run now, or null. */
export async function couponGuard(db: Queryable, secret: string, ipKey: string | null, now: Date): Promise<string | null> {
  if (ipKey && (await hits(db, ipKey, now)) >= LIMITS.couponIp) return GUARD_MESSAGES.tooMany;
  if ((await hits(db, siteKey(secret), now)) >= LIMITS.couponFailuresSiteWide) return GUARD_MESSAGES.paused;
  return null;
}

/** The per-IP key for coupon tries (separate from the enrollment counter). */
export function couponIpKey(secret: string, ip: string): string | null {
  return ip ? hashKey(secret, "coupon", ip) : null;
}

export async function countCouponTry(db: Queryable, ipKey: string | null, now: Date): Promise<void> {
  if (ipKey) await bump(db, ipKey, now);
}

/** One more wrong code this hour; at exactly the limit the team is told (once per hour, deduplicated). */
export async function countCouponFailure(db: Queryable, secret: string, now: Date): Promise<void> {
  const key = siteKey(secret);
  await bump(db, key, now);
  if ((await hits(db, key, now)) === LIMITS.couponFailuresSiteWide) {
    await enqueue(
      db,
      [
        {
          kind: "telegram",
          dedupeKey: `tg:coupon-paused:${windowStart(now).toISOString()}`,
          payload: {
            template: "coupon_paused",
            html: composeTelegram("⚠️ Coupon check paused", [
              ["Why", `${LIMITS.couponFailuresSiteWide} wrong coupon codes in one hour. Someone may be guessing codes.`],
              ["Until", "the end of this hour (it starts again by itself)"],
            ]),
          },
        },
      ],
      now,
    );
  }
}
