/*
 * The draft as a `registrations` row (architecture §1.2; replaces the
 * plugin field mapping of Option A). Only the answers of the draft's own
 * template are kept, and only the ones that apply: a code typed under
 * "I can pay" is never stored, a help note only with "I need help".
 *
 * Fee, status, route and Stripe fields are not here: the server decides
 * them (src/lib/server/enroll/submit.ts). Pure, so the tests run it directly.
 */

import { courseById } from "../../content/pricing.ts";
import type { registrations } from "../../db/schema.ts";
import { countryName } from "./options.ts";
import { ageOn, summerLevel, toE164, type Draft } from "./schema.ts";
import { timeSlotText, zoneShort } from "./schedule.ts";

export type RegistrationInsert = typeof registrations.$inferInsert;

export type Program = "monthly" | "summer_l1" | "summer_l2" | "weekend_new" | "weekend_existing";

/** The plugin's form type for this draft (re-enrollment matches on it, RE:41-56). */
export function programOf(d: Draft, today: string): Program {
  if (d.variant === "weekend") return d.existing === "yes" ? "weekend_existing" : "weekend_new";
  if (d.variant === "summer") return summerLevel(d.dob, today) === "level2" ? "summer_l2" : "summer_l1";
  return "monthly";
}

/** "Free Enrollment", … : the plugin's Meta content names (A12), also the email and Telegram labels. */
export function programLabel(program: Program): string {
  return {
    monthly: "Free Enrollment",
    summer_l1: "Summer Program Level 1",
    summer_l2: "Summer Program Level 2",
    weekend_new: "Weekend Ilm Program (New)",
    weekend_existing: "Weekend Ilm Program (Existing)",
  }[program];
}

/** Every phone the eligibility rule reads for this template (EL:30-34). */
export function phonesOf(d: Draft): string[] {
  const phone = toE164(d.phoneCountry, d.phone) ?? "";
  if (d.variant !== "summer") return [phone];
  return [phone, d.whatsappSame ? "" : (toE164(d.whatsappCountry, d.whatsapp) ?? "")];
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export function registrationFields(d: Draft, today: string, now: Date): RegistrationInsert {
  const program = programOf(d, today);
  const phone = toE164(d.phoneCountry, d.phone);
  const base: RegistrationInsert = {
    program,
    createdVia: "public",
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    dateOfBirth: d.dob,
    ageAtSignup: ageOn(d.dob, today),
    guardianName: orNull(d.guardianName),
    email: d.email.trim(),
    countryResCode: d.residence,
    countryResName: countryName(d.residence),
    countryOriginCode: d.origin,
    countryOriginName: countryName(d.origin),
    referral: d.referral || null,
    referralOther: d.referral === "other" ? orNull(d.referralOther) : null,
    waUpdates: d.waUpdates,
    futureUpdates: d.futureUpdates,
    termsAcceptedAt: d.terms ? now : null,
    submitId: d.submitId,
  };

  if (d.variant === "weekend") {
    return {
      ...base,
      whatsappE164: phone,
      existingStudent: d.existing === "yes",
      // N9: the timing consent is required and stored with its time.
      timingConsentAt: d.timingConsent ? now : null,
      timeZone: d.timeZone || null,
      timeZoneLabel: d.timeZone ? zoneShort(d.timeZone, now) : null,
      admissionFee: "free",
      paymentStatus: "not_required",
    };
  }

  if (d.variant === "summer") {
    const help = d.summerFee === "help";
    return {
      ...base,
      guardianContactE164: phone,
      guardianWhatsappE164: d.whatsappSame ? phone : toE164(d.whatsappCountry, d.whatsapp),
      whatsappGroup: d.whatsappGroup || null,
      admissionFee: d.summerFee === "standard" ? "standard" : d.summerFee === "existing" ? "complimentary" : "flexible",
      flexibleFeeNote: !help ? null : d.summerHelp === "free" ? "Requesting Free Enrollment" : `$${d.summerAmount.trim().replace(/^\$/, "")}`,
    };
  }

  const course = d.courseId ? courseById(d.courseId) : null;
  const help = d.feeChoice === "help";
  return {
    ...base,
    whatsappE164: phone,
    languages: [...d.languages],
    languagesOther: d.languages.includes("other") ? orNull(d.languagesOther) : null,
    existingStudent: d.existing === "yes" ? true : d.existing === "no" ? false : null,
    quranLevel: d.quranLevel || null,
    memorized: orNull(d.memorized),
    teacherPref: d.teacherPref || null,
    courseKey: course?.priceKey ?? null,
    courseVariant: course?.id ?? null,
    daysPerWeek: d.daysPerWeek || null,
    preferredDays: [...d.days],
    sessionMinutes: d.classLength || null,
    timeStart: d.from || null,
    timeEnd: d.to || null,
    timeZone: d.timeZone || null,
    timeZoneLabel: d.timeZone ? zoneShort(d.timeZone, now) : null,
    timeSlotText: d.from && d.to && d.timeZone ? timeSlotText(d.from, d.to, d.timeZone) : null,
    aidLevel: help ? d.helpLevel || null : null,
    aidNote: help ? orNull(d.helpNote) : null,
    whatsappGroup: d.whatsappGroup || null,
  };
}
