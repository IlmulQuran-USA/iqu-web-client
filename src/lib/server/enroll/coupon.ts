import { and, count, eq, isNull } from "drizzle-orm";
import { couponRedemptions, coupons } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";
import type { PriceKey } from "../../../content/pricing.ts";
import { percentOf } from "../../money.ts";

/*
 * Scholarship codes (port of includes/class-iqu-coupon.php v3.7.20:
 * effective_status CP:69-93, validate CP:178-263, discount_for CP:265-283,
 * declaration_text CP:289-312). Messages are the live ones, except that the
 * course names use the site's spelling.
 *
 * The state order is the plugin's: disabled, then expired (end date in the
 * site time zone, Asia/Dhaka), then used up (max_uses; NULL = no limit).
 * Usage counts the redemptions that were not released. At submit the coupon
 * row is locked (SELECT … FOR UPDATE) inside the enrollment transaction, so
 * two families can never take the last use at once (the plugin's E36 race
 * cannot happen here).
 */

export const COUPON_CODE = /^[A-Z0-9-]{4,40}$/;

/** "2026-11-25" in Asia/Dhaka: the plugin's site time zone (WordPress timezone_string, read 25 Nov 2026). */
export function todayInDhaka(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const COURSE_NAMES: Record<PriceKey, string> = {
  qaidah: "Noorani Qaidah or Quran Nazirah",
  hifz: "Quran Hifz",
  arabic: "Quranic Arabic",
  tarjumatul_quran: "Tarjumatul Quran",
  islamic_studies: "Islamic Studies",
};

export const COUPON_MESSAGES = {
  empty: "Please enter a coupon code.",
  invalid: "This coupon code is not valid. Please check the code and try again.",
  expired: "This coupon code has expired. Please contact us for a new one.",
  usedUp: "This coupon code has already been used. Please contact us for a new one.",
  noBase: "Please select your course and class days before applying a coupon.",
  course: (key: string) =>
    `This coupon is only valid for ${COURSE_NAMES[key as PriceKey] ?? key}. Please select that course or use a different code.`,
} as const;

export type CouponQuote = {
  couponId: number;
  code: string;
  discountCents: number;
  finalCents: number;
  /** Rounded to 2 decimals, as the plugin shows it. */
  percent: number;
  declaration: string;
};

export type CouponCheck = { ok: true; quote: CouponQuote } | { ok: false; message: string };

/** "$48.00": the plugin's IQU_Pricing::format, kept inside the live declaration text. */
function plainUsd(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** CP:289-312, word for word. */
export function declarationText(percent: number, discountCents: number): string {
  const p = Math.round(percent);
  if (p >= 100) {
    return (
      "I sincerely confirm that, due to genuine financial hardship, I believe I am eligible to receive Zakat assistance. " +
      `I gratefully accept a full (100%) scholarship covering ${plainUsd(discountCents)} of monthly tuition from the Zakat fund of ` +
      "Ilm-Ul-Quran USA. I affirm that, to the best of my knowledge, the information I have provided is truthful and complete."
    );
  }
  return (
    "I sincerely confirm that, due to genuine financial hardship, I believe I am eligible to receive Zakat assistance. " +
    `I gratefully accept a ${p}% scholarship (${plainUsd(discountCents)} per month) from the Zakat fund of Ilm-Ul-Quran USA. ` +
    "I affirm that, to the best of my knowledge, the information I have provided is truthful and complete."
  );
}

/**
 * Checks a code for a course and a base fee. `lock` takes a row lock (call it
 * inside the enrollment transaction); the quote is then safe to redeem.
 */
export async function checkCouponCode(
  db: Queryable,
  input: { code: string; priceKey: PriceKey; baseCents: number; now: Date; lock?: boolean },
): Promise<CouponCheck> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, message: COUPON_MESSAGES.empty };
  if (!COUPON_CODE.test(code)) return { ok: false, message: COUPON_MESSAGES.invalid };

  const query = db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  const [coupon] = input.lock ? await query.for("update") : await query;
  // The same message for an unknown and a disabled code, so guessing reveals nothing (CP:209-216).
  if (!coupon || coupon.status !== "active") return { ok: false, message: COUPON_MESSAGES.invalid };
  if (coupon.expiresOn && coupon.expiresOn < todayInDhaka(input.now)) return { ok: false, message: COUPON_MESSAGES.expired };
  if (coupon.maxUses !== null) {
    const [{ used }] = await db
      .select({ used: count() })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), isNull(couponRedemptions.releasedAt)));
    if (Number(used) >= coupon.maxUses) return { ok: false, message: COUPON_MESSAGES.usedUp };
  }
  if (coupon.courseKey !== "ALL" && coupon.courseKey !== input.priceKey) return { ok: false, message: COUPON_MESSAGES.course(coupon.courseKey) };
  if (input.baseCents <= 0) return { ok: false, message: COUPON_MESSAGES.noBase };

  const discountCents =
    coupon.discountType === "percent"
      ? percentOf(input.baseCents, Math.min(100, Math.max(0, coupon.valuePercent ?? 0)))
      : Math.min(Math.max(0, coupon.valueCents ?? 0), input.baseCents);
  const percent = Math.round((discountCents / input.baseCents) * 10_000) / 100;
  return {
    ok: true,
    quote: {
      couponId: coupon.id,
      code: coupon.code,
      discountCents,
      finalCents: input.baseCents - discountCents,
      percent,
      declaration: declarationText(percent, discountCents),
    },
  };
}
