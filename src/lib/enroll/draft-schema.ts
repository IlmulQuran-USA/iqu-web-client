/*
 * The /enroll draft's shape, in zod, so the server action can parse an
 * untrusted copy and the browser can check a draft restored from this
 * device. The step rules and their messages live in schema.ts.
 *
 * Kept apart from schema.ts so zod never reaches /enroll's first load: the
 * browser imports this module only when it has a saved draft or a sibling
 * seed to restore (EnrollFlow). zod/mini, not "zod": the same parser and the
 * same rules, but smaller. Only success and data are read, never zod's
 * messages (js-budget, 26 Nov 2026).
 */

import * as z from "zod/mini";
import { monthlyCourses, type CourseId } from "../../content/pricing.ts";
import { HELP_LEVELS, LANGUAGES, QURAN_LEVELS, REFERRALS, TEACHER_PREFS, WEEKDAYS } from "./options.ts";
import { PHONE_COUNTRIES } from "./schema.ts";

const text = (max: number) => z.string().check(z.maxLength(max));
const oneOf = <T extends readonly { value: string }[]>(list: T) =>
  z.enum(list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]]);
const orEmpty = <T extends z.ZodMiniType>(schema: T) => z.union([schema, z.literal("")]);
/** A whole number from min to max (classic zod's number().int().min().max()). */
const wholeNumber = (min: number, max: number) => z.int().check(z.minimum(min), z.maximum(max));

export const couponSchema = z.object({
  code: text(40),
  discount: z.number().check(z.nonnegative()),
  final: z.number().check(z.nonnegative()),
  percent: z.number().check(z.minimum(0), z.maximum(100)),
  declaration: text(1000),
});
export type AppliedCoupon = z.infer<typeof couponSchema>;

export const draftSchema = z.object({
  v: z.literal(1),
  variant: z.enum(["monthly", "weekend", "summer"]),
  submitId: z.string().check(z.regex(/^[A-Za-z0-9-]{16,64}$/)),
  // Student
  who: z.enum(["child", "self", ""]),
  firstName: text(100),
  lastName: text(100),
  dob: text(10),
  guardianName: text(150),
  email: text(191),
  phoneCountry: z.enum(PHONE_COUNTRIES),
  phone: text(30),
  whatsappSame: z.boolean(),
  whatsappCountry: z.enum(PHONE_COUNTRIES),
  whatsapp: text(30),
  residence: text(2),
  origin: text(2),
  languages: z.array(oneOf(LANGUAGES)).check(z.maxLength(LANGUAGES.length)),
  languagesOther: text(100),
  existing: z.enum(["yes", "no", ""]),
  // Course
  courseId: orEmpty(z.enum(monthlyCourses.map((c) => c.id) as [CourseId, ...CourseId[]])),
  quranLevel: orEmpty(oneOf(QURAN_LEVELS)),
  memorized: text(500),
  teacherPref: orEmpty(oneOf(TEACHER_PREFS)),
  // Schedule
  timeZone: text(64),
  daysPerWeek: wholeNumber(0, 7),
  days: z.array(z.enum(WEEKDAYS.map((d) => d.value) as [string, ...string[]])).check(z.maxLength(7)),
  classLength: wholeNumber(0, 60),
  from: text(5),
  to: text(5),
  // Fees (monthly)
  feeChoice: z.enum(["pay", "help", "code", ""]),
  special: z.boolean(),
  helpLevel: orEmpty(oneOf(HELP_LEVELS)),
  helpNote: text(500),
  couponCode: text(40),
  couponApplied: z.nullable(couponSchema),
  zakatDeclaration: z.boolean(),
  // Summer fee
  summerFee: z.enum(["standard", "existing", "help", ""]),
  summerHelp: z.enum(["amount", "free", ""]),
  summerAmount: text(10),
  // Weekend
  timingConsent: z.boolean(),
  // Review
  referral: orEmpty(oneOf(REFERRALS)),
  referralOther: text(100),
  waUpdates: z.boolean(),
  futureUpdates: z.boolean(),
  whatsappGroup: z.enum(["yes", "no", ""]),
  terms: z.boolean(),
});

export type Draft = z.infer<typeof draftSchema>;
