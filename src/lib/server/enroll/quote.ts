import { courseById, type CourseId } from "../../../content/pricing.ts";
import { waitlist } from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import type { AppliedCoupon } from "../../enroll/schema.ts";
import { hashKey } from "../keys.ts";
import { LIMITS, bump, under } from "../rate.ts";
import { checkCouponCode } from "./coupon.ts";
import { countCouponFailure, countCouponTry, couponGuard, couponIpKey } from "./coupon-guard.ts";
import { isPriceError, priceMonthly } from "./price.ts";
import type { CaptchaCheck } from "./submit.ts";

/*
 * "Apply" for a scholarship code (port of public/class-iqu-form.php
 * handle_apply_coupon F:1157-1229) and the US/CA waitlist (plan S10; plugin
 * includes/class-iqu-waitlist.php), both on our database. Apply only checks:
 * the code is redeemed with the enrollment, in its transaction.
 */

export type QuoteDeps = { now: Date; hashSecret: string; verifyCaptcha: CaptchaCheck };

export type CouponQuoteResult = { status: "ok"; coupon: AppliedCoupon; message: string } | { status: "error"; message: string };

const VERIFY = "Verification failed. Please try again.";

export async function quoteCouponCore(
  db: AnyDb,
  input: { code: string; courseId: string; daysPerWeek: number; recaptchaToken: string; ip: string; host: string },
  deps: QuoteDeps,
): Promise<CouponQuoteResult> {
  const ipKey = couponIpKey(deps.hashSecret, input.ip);
  const guard = await couponGuard(db, deps.hashSecret, ipKey, deps.now);
  if (guard) return { status: "error", message: guard };
  await countCouponTry(db, ipKey, deps.now);

  const captcha = await deps.verifyCaptcha(input.recaptchaToken, "iqu_apply_coupon", input.host);
  if (!captcha.ok) return { status: "error", message: VERIFY };

  let course;
  try {
    course = courseById(input.courseId as CourseId);
  } catch {
    return { status: "error", message: "Please select your course before applying a coupon." };
  }
  const price = priceMonthly(course.id, input.daysPerWeek, false);
  if (isPriceError(price)) return { status: "error", message: price.message || "Please select your class days before applying a coupon." };

  const check = await checkCouponCode(db, { code: input.code, priceKey: course.priceKey, baseCents: price.calculatedCents, now: deps.now });
  if (!check.ok) {
    await countCouponFailure(db, deps.hashSecret, deps.now);
    return { status: "error", message: check.message };
  }
  const q = check.quote;
  return {
    status: "ok",
    coupon: { code: q.code, discount: q.discountCents / 100, final: q.finalCents / 100, percent: q.percent, declaration: q.declaration },
    message: `Coupon applied: $${(q.discountCents / 100).toFixed(2)} scholarship granted from the Zakat fund.`,
  };
}

export type WaitlistResult = { status: "ok"; message: string } | { status: "error"; message: string };

export const WAITLIST_THANKS = "JazakAllahu Khairan! We will email you when our classes open in your country, in sha’ Allah.";

export async function joinWaitlistCore(
  db: AnyDb,
  input: { email: string; name: string; program: "monthly" | "weekend" | "summer"; country: string; recaptchaToken: string; ip: string; host: string },
  deps: QuoteDeps,
): Promise<WaitlistResult> {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 191) {
    return { status: "error", message: "Enter an email address in the format name@example.com." };
  }
  const ipKey = input.ip ? hashKey(deps.hashSecret, "waitlist", input.ip) : null;
  if (ipKey && !(await under(db, ipKey, LIMITS.waitlistIp, deps.now))) return { status: "error", message: "Too many attempts. Please try again later." };
  const captcha = await deps.verifyCaptcha(input.recaptchaToken, "iqu_waitlist", input.host);
  if (!captcha.ok) return { status: "error", message: VERIFY };
  // Joining twice is not an error to the person: the same thanks either way, nothing revealed.
  await db
    .insert(waitlist)
    .values({
      email,
      name: input.name.trim().slice(0, 100) || null,
      country: /^[A-Z]{2}$/.test(input.country) ? input.country : null,
      program: input.program,
      source: "enroll",
      createdAt: deps.now,
    })
    .onConflictDoNothing();
  if (ipKey) await bump(db, ipKey, deps.now);
  return { status: "ok", message: WAITLIST_THANKS };
}
