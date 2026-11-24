/*
 * Fee quote for /enroll, from src/content/pricing.ts (the single source of
 * every price; PLUGIN-INVENTORY §2). The plugin recalculates every amount on
 * the server; this quote is what the family sees while they choose.
 *
 * Rules kept here:
 * - fee = days × 4 × per-class rate; class length never changes it;
 * - days per week stay inside the course's range (Hifz 3–7; Quranic Arabic
 *   Level 1 fixed at 4 on the website, owner decision 8);
 * - the Special plan (Qa'idah / Nazirah, 3–7 days) is opt-in and never
 *   combined with a scholarship code;
 * - a help request is a request: the amounts shown are what the family would
 *   pay if the team agrees, and the team confirms the fee (decision 3).
 */

import { courseById, monthlyFee, programs, specialPlanFee, type CourseId, type MonthlyCourse } from "../../content/pricing.ts";
import { HELP_LEVELS, type HelpLevel } from "./options.ts";

export type MonthlyQuote = {
  course: MonthlyCourse;
  daysPerWeek: number;
  classesPerMonth: number;
  perClass: number;
  /** The full monthly fee, USD. */
  full: number;
  /** The Special plan fee for this choice, or null when the course or day count has none. */
  special: number | null;
};

/** Allowed days a week for a course, e.g. [3,4,5,6,7] for Hifz, [4] for Arabic Level 1. */
export function allowedDays(course: MonthlyCourse): number[] {
  return Array.from({ length: course.maxDays - course.minDays + 1 }, (_, i) => course.minDays + i);
}

/** An error for a day count, or undefined when it is allowed. */
export function daysError(course: MonthlyCourse, days: number): string | undefined {
  if (!days) return "Choose how many days a week.";
  if (course.minDays === course.maxDays && days !== course.minDays) {
    return `${course.label} meets ${course.minDays} days a week.`;
  }
  if (days < course.minDays) return `${course.label} needs at least ${course.minDays} days a week.`;
  if (days > course.maxDays) return `Choose ${course.maxDays} days a week or fewer.`;
  return undefined;
}

export function quoteMonthly(courseId: CourseId, daysPerWeek: number): MonthlyQuote | null {
  const course = courseById(courseId);
  if (daysError(course, daysPerWeek)) return null;
  const full = monthlyFee(course, daysPerWeek);
  const classesPerMonth = daysPerWeek * 4;
  return {
    course,
    daysPerWeek,
    classesPerMonth,
    perClass: full / classesPerMonth,
    full,
    special: specialPlanFee(course, daysPerWeek),
  };
}

/** What the family would pay each month with this much help, in USD (cents kept). */
export function afterHelp(full: number, level: HelpLevel): number {
  const percent = HELP_LEVELS.find((h) => h.value === level)?.percent ?? 0;
  return Math.round(full * (100 - percent)) / 100;
}

/** "$48" or "$33.60": whole dollars without cents, otherwise two decimals. */
export function money(amount: number): string {
  const whole = Number.isInteger(amount);
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Summer: the one public fee (owner correction A: the supported rate is never shown). */
export const SUMMER_STANDARD_FEE = programs.summer.fee;

/** A "pay what you can" amount: whole dollars or cents, $1–$1000 (the plugin's FLEXIBLE_MAX). */
export function payWhatYouCanError(raw: string): string | undefined {
  const value = raw.trim().replace(/^\$/, "");
  if (!value) return "Enter the amount you can pay, or choose to request a free place.";
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value)) return "Enter an amount in dollars, for example 20.";
  const n = Number(value);
  if (n < 1) return "Enter at least $1, or choose to request a free place.";
  if (n > 1000) return "Enter an amount up to $1,000, or contact us.";
  return undefined;
}
