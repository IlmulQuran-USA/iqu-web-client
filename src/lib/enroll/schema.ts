/*
 * The /enroll draft's rules for each step (one set of messages for the
 * browser and the server); its shape is draft-schema.ts. The plugin
 * validates again on its side; these rules mirror it and add the owner's
 * decisions of 24 Nov 2026.
 */

// No zod here: this module runs in the browser on every /enroll visit, so the
// draft shape (zod) lives in draft-schema.ts and loads only when needed
// (js-budget, 26 Nov 2026). Only its types are imported.
import type { AppliedCoupon, Draft } from "./draft-schema.ts";
import { courseById } from "../../content/pricing.ts";
import { daysError, payWhatYouCanError } from "./fees.ts";
import { countries } from "./options.ts";
import type { Variant } from "./params.ts";
import { isValidZone, windowErrors } from "./schedule.ts";

export type { AppliedCoupon, Draft };

export const PHONE_COUNTRIES = ["US", "CA", "OTHER"] as const;
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];

export function emptyDraft(variant: Variant, submitId: string): Draft {
  return {
    v: 1,
    variant,
    submitId,
    who: variant === "monthly" ? "" : "child",
    firstName: "",
    lastName: "",
    dob: "",
    guardianName: "",
    email: "",
    phoneCountry: "US",
    phone: "",
    whatsappSame: true,
    whatsappCountry: "US",
    whatsapp: "",
    residence: "",
    origin: "",
    languages: [],
    languagesOther: "",
    existing: "",
    courseId: "",
    quranLevel: "",
    memorized: "",
    teacherPref: "",
    timeZone: "",
    daysPerWeek: 0,
    days: [],
    classLength: 0,
    from: "",
    to: "",
    feeChoice: "",
    special: false,
    helpLevel: "",
    helpNote: "",
    couponCode: "",
    couponApplied: null,
    zakatDeclaration: false,
    summerFee: "",
    summerHelp: "",
    summerAmount: "",
    timingConsent: false,
    referral: "",
    referralOther: "",
    waUpdates: false,
    futureUpdates: false,
    whatsappGroup: "",
    terms: false,
  };
}

/* ── Steps ───────────────────────────────────────────────────────────── */

export type StepId = "student" | "course" | "schedule" | "fees" | "weekendSchedule" | "summerFee" | "review";

export const STEPS: Record<Variant, readonly { id: StepId; label: string }[]> = {
  monthly: [
    { id: "student", label: "Student" },
    { id: "course", label: "Course" },
    { id: "schedule", label: "Schedule" },
    { id: "fees", label: "Fees" },
    { id: "review", label: "Review" },
  ],
  weekend: [
    { id: "student", label: "Student" },
    { id: "weekendSchedule", label: "Schedule" },
    { id: "review", label: "Review" },
  ],
  summer: [
    { id: "student", label: "Student" },
    { id: "summerFee", label: "Fee" },
    { id: "review", label: "Review" },
  ],
};

/** Ages per template: the live plugin's bounds (validator v_dob). */
export const AGE_BOUNDS: Record<Variant, { min: number; max: number }> = {
  monthly: { min: 4, max: 100 },
  weekend: { min: 5, max: 12 },
  summer: { min: 5, max: 15 },
};

export type Errors = Partial<Record<string, string>>;

/* ── Dates and phones ────────────────────────────────────────────────── */

/** Today's calendar date "YYYY-MM-DD" in the visitor's zone (or UTC on the server). */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isRealDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Mar 2017" (CLAUDE.md §4 date style), or "" for an incomplete date. */
export function displayDate(iso: string): string {
  if (!isRealDate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Whole years between two ISO dates. A 29 Feb birthday falls on 28 Feb in other years (plugin rule). */
export function ageOn(dob: string, today: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Summer level from the date of birth (owner decision 17): 5–10 Level 1, 11–15 Level 2. */
export function summerLevel(dob: string, today: string): "level1" | "level2" | null {
  if (!isRealDate(dob)) return null;
  const age = ageOn(dob, today);
  if (age >= 5 && age <= 10) return "level1";
  if (age >= 11 && age <= 15) return "level2";
  return null;
}

/**
 * E.164 for a typed number, or null when it is not valid.
 * US/Canada: ten digits (a leading 1 is allowed), area code and exchange
 * starting 2–9. Other: the full number with + and the country code, 7–15 digits.
 */
export function toE164(country: PhoneCountry, raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (country === "OTHER") {
    if (!raw.trim().startsWith("+")) return null;
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? `+1${national}` : null;
}

function phoneError(country: PhoneCountry, raw: string, what: string): string | undefined {
  if (!raw.trim()) return `Enter ${what}.`;
  if (toE164(country, raw)) return undefined;
  return country === "OTHER"
    ? "Enter the full number with + and the country code, for example +44 20 7946 0958."
    : "Enter a 10-digit US or Canadian number, for example (214) 555-0123.";
}

const NAME = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function nameError(value: string, what: string): string | undefined {
  const v = value.trim();
  if (!v) return `Enter ${what}.`;
  if (!NAME.test(v)) return `Use letters only in ${what}.`;
  return undefined;
}

export function isAdultOn(draft: Draft, today: string): boolean | null {
  if (!isRealDate(draft.dob)) return null;
  return ageOn(draft.dob, today) >= 18;
}

/** Whether the guardian's name is asked: always for Weekend and Summer, and for a child or anyone under 18. */
export function asksGuardian(draft: Draft, today: string): boolean {
  if (draft.variant !== "monthly") return true;
  return draft.who === "child" || isAdultOn(draft, today) === false;
}

export function isHifz(draft: Draft): boolean {
  return draft.courseId !== "" && courseById(draft.courseId).priceKey === "hifz";
}

/* ── Step rules ──────────────────────────────────────────────────────── */

function student(d: Draft, today: string): Errors {
  const e: Errors = {};
  if (d.variant === "monthly" && !d.who) e.who = "Tell us who the classes are for.";
  e.firstName = nameError(d.firstName, "the first name");
  e.lastName = nameError(d.lastName, "the last name");

  const { min, max } = AGE_BOUNDS[d.variant];
  if (!d.dob) e.dob = "Enter the date of birth.";
  else if (!isRealDate(d.dob) || d.dob > today) e.dob = "Choose a real date of birth.";
  else {
    const age = ageOn(d.dob, today);
    if (age < min || age > max) {
      e.dob =
        d.variant === "summer"
          ? "The Summer Ilm Camp is for ages 5 to 15."
          : d.variant === "weekend"
            ? "The Weekend Ilm Program is for ages 5 to 12."
            : `Students must be between ${min} and ${max} years old.`;
    }
  }

  const adult = isAdultOn(d, today);
  const guardianRequired = d.variant !== "monthly" || adult === false;
  if (asksGuardian(d, today) && guardianRequired) e.guardianName = nameError(d.guardianName, "the parent or guardian's name");
  else if (d.guardianName.trim() && !NAME.test(d.guardianName.trim())) e.guardianName = "Use letters only in the parent or guardian's name.";

  if (!d.email.trim()) e.email = "Enter an email address.";
  else if (!EMAIL.test(d.email.trim())) e.email = "Enter an email address in the format name@example.com.";

  e.phone = phoneError(d.phoneCountry, d.phone, d.variant === "summer" ? "a phone number" : "a WhatsApp number");
  if (d.variant === "summer" && !d.whatsappSame) e.whatsapp = phoneError(d.whatsappCountry, d.whatsapp, "a WhatsApp number");

  const known = (code: string) => countries().some((c) => c.code === code);
  if (!d.residence) e.residence = "Choose the country where the student lives.";
  else if (!known(d.residence)) e.residence = "Choose a country from the list.";
  if (!d.origin) e.origin = "Choose the country of origin.";
  else if (!known(d.origin)) e.origin = "Choose a country from the list.";

  if (d.variant === "monthly") {
    if (d.languages.length === 0) e.languages = "Choose at least one language.";
    else if (d.languages.includes("other") && !d.languagesOther.trim()) e.languagesOther = "Tell us which other language.";
  }
  if (d.variant !== "summer" && !d.existing) e.existing = "Tell us whether the student already studies with us.";
  return e;
}

function course(d: Draft): Errors {
  const e: Errors = {};
  if (!d.courseId) e.courseId = "Choose a course.";
  if (!d.quranLevel) e.quranLevel = "Choose the reading level that fits best.";
  // Owner decision 16: required for Hifz, optional for every other course.
  if (isHifz(d) && !d.memorized.trim()) e.memorized = "Tell us what has been memorized so far. Write “None yet” if nothing.";
  if (!d.teacherPref) e.teacherPref = "Choose a teacher preference.";
  return e;
}

function schedule(d: Draft): Errors {
  const e: Errors = {};
  if (!d.timeZone) e.timeZone = "Choose your time zone.";
  else if (!isValidZone(d.timeZone)) e.timeZone = "Choose a time zone from the list.";
  if (d.courseId) e.daysPerWeek = daysError(courseById(d.courseId), d.daysPerWeek);
  else if (!d.daysPerWeek) e.daysPerWeek = "Choose how many days a week.";
  if (d.days.length === 0) e.days = "Choose at least one day that works.";
  else if (d.daysPerWeek && d.days.length > d.daysPerWeek) e.days = `Choose up to ${d.daysPerWeek} days.`;
  if (![30, 40, 50, 60].includes(d.classLength)) e.classLength = "Choose a class length.";
  const w = windowErrors(d.from, d.to, d.classLength);
  e.from = w.from;
  e.to = w.to;
  return e;
}

function fees(d: Draft): Errors {
  const e: Errors = {};
  if (!d.feeChoice) e.feeChoice = "Choose how you would like to pay.";
  if (d.feeChoice === "help" && !d.helpLevel) e.helpLevel = "Choose how much help to ask for.";
  if (d.feeChoice === "code") {
    const typed = d.couponCode.trim().toUpperCase();
    if (!typed) e.couponCode = "Enter your scholarship code.";
    else if (!/^[A-Z0-9-]{4,40}$/.test(typed)) e.couponCode = "Check the code: it uses letters, numbers and dashes.";
    else if (!d.couponApplied || d.couponApplied.code !== typed) e.couponCode = "Press Apply to check your code.";
    else if (!d.zakatDeclaration) e.zakatDeclaration = "Please confirm the declaration to use your scholarship code.";
  }
  return e;
}

function weekendSchedule(d: Draft): Errors {
  return d.timingConsent ? {} : { timingConsent: "Please confirm that the student can attend both classes." };
}

function summerFee(d: Draft): Errors {
  const e: Errors = {};
  if (!d.summerFee) e.summerFee = "Choose a fee option.";
  if (d.summerFee === "help") {
    if (!d.summerHelp) e.summerHelp = "Choose what you can pay.";
    else if (d.summerHelp === "amount") e.summerAmount = payWhatYouCanError(d.summerAmount);
  }
  return e;
}

function review(d: Draft): Errors {
  const e: Errors = {};
  if (!d.referral) e.referral = "Tell us how you heard about us.";
  else if (d.referral === "other" && !d.referralOther.trim()) e.referralOther = "Tell us where you heard about us.";
  if (d.variant === "summer" && !d.whatsappGroup) e.whatsappGroup = "Tell us whether to add you to the parents' WhatsApp group.";
  if (!d.terms) e.terms = "Please agree to the terms and privacy policy.";
  return e;
}

const RULES: Record<StepId, (d: Draft, today: string) => Errors> = {
  student,
  course,
  schedule,
  fees,
  weekendSchedule,
  summerFee,
  review,
};

/** The errors of one step, with empty entries removed. */
export function validateStep(draft: Draft, step: StepId, today: string): Errors {
  const raw = RULES[step](draft, today);
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v)) as Errors;
}

/** Every step of the draft's template, in order: the first step with errors and its errors. */
export function validateAll(draft: Draft, today: string): { step: StepId; errors: Errors } | null {
  for (const { id } of STEPS[draft.variant]) {
    const errors = validateStep(draft, id, today);
    if (Object.keys(errors).length > 0) return { step: id, errors };
  }
  return null;
}

/** Which step owns a field, for errors that come back from the server. */
export function stepOfField(variant: Variant, field: string): StepId {
  const owners: Record<string, StepId> = {
    courseId: "course",
    quranLevel: "course",
    memorized: "course",
    teacherPref: "course",
    timeZone: "schedule",
    daysPerWeek: "schedule",
    days: "schedule",
    classLength: "schedule",
    from: "schedule",
    to: "schedule",
    feeChoice: "fees",
    helpLevel: "fees",
    couponCode: "fees",
    zakatDeclaration: "fees",
    special: "fees",
    timingConsent: "weekendSchedule",
    summerFee: "summerFee",
    summerHelp: "summerFee",
    summerAmount: "summerFee",
    referral: "review",
    referralOther: "review",
    whatsappGroup: "review",
    terms: "review",
  };
  const step = owners[field] ?? "student";
  return STEPS[variant].some((s) => s.id === step) ? step : "review";
}
