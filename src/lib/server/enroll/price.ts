import { courseById, monthlyFee, specialPlanFee, type CourseId, type MonthlyCourse } from "../../../content/pricing.ts";
import { toCents } from "../../money.ts";
import { daysError } from "../../enroll/fees.ts";

/*
 * Server pricing in cents (PLUGIN-INVENTORY §2; plugin IQU_Pricing::calculate
 * P:220-264 and calculate_special P:299-336, called from the submit handler
 * public/class-iqu-form.php:977-1029). The browser's amounts are never used:
 * every figure is recomputed here from src/content/pricing.ts.
 */

export type MonthlyPrice = {
  course: MonthlyCourse;
  daysPerWeek: number;
  perClassCents: number;
  /** Full monthly fee. */
  calculatedCents: number;
  /** Special plan: the reduction (0 when not taken). */
  specialDiscountCents: number;
};

export type PriceError = { field: "daysPerWeek" | "special"; message: string };

export function priceMonthly(courseId: CourseId, daysPerWeek: number, wantsSpecial: boolean): MonthlyPrice | PriceError {
  const course = courseById(courseId);
  const bad = daysError(course, daysPerWeek);
  if (bad) return { field: "daysPerWeek", message: bad };
  const calculatedCents = toCents(monthlyFee(course, daysPerWeek));
  const perClassCents = calculatedCents / (daysPerWeek * 4);
  let specialDiscountCents = 0;
  if (wantsSpecial) {
    const special = specialPlanFee(course, daysPerWeek);
    if (special === null) return { field: "special", message: "The special discount is for Noorani Qaidah or Quran Nazirah, 3 to 7 days a week." };
    specialDiscountCents = calculatedCents - toCents(special);
  }
  return { course, daysPerWeek, perClassCents, calculatedCents, specialDiscountCents };
}

export function isPriceError(p: MonthlyPrice | PriceError): p is PriceError {
  return "message" in p;
}
