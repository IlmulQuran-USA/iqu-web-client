/*
 * The draft as the iqu-registration plugin's fields: the contract in
 * F:/iqu-setup/reports/enroll-plugin-changes.md ("Fields"). Live field names
 * are kept wherever they exist; new ones are listed there (N1–N19).
 *
 * Only the fields of the draft's own template are sent, and only the answers
 * that apply (e.g. no coupon unless the family chose "I have a scholarship
 * code"), so a stale answer in the draft never reaches WordPress.
 */

import { courseById } from "../../content/pricing.ts";
import { countryName } from "./options.ts";
import { summerLevel, toE164, type Draft } from "./schema.ts";
import { namedZone, timeSlotText, zoneShort } from "./schedule.ts";

export type PluginForm = "free" | "weekend" | "summer";
export type PluginFields = Record<string, string | number | string[]>;

const yesNo = (b: boolean) => (b ? "yes" : "no");
const bit = (b: boolean) => (b ? 1 : 0);

function common(d: Draft): PluginFields {
  return {
    first_name: d.firstName.trim(),
    last_name: d.lastName.trim(),
    email: d.email.trim(),
    date_of_birth: d.dob,
    guardian_name: d.guardianName.trim(),
    country_res: countryName(d.residence),
    country_res_code: d.residence,
    country_origin: countryName(d.origin),
    country_origin_code: d.origin,
    referral: d.referral,
    referral_other: d.referral === "other" ? d.referralOther.trim() : "",
    wa_updates: bit(d.waUpdates),
    future_updates: bit(d.futureUpdates),
    terms_accepted: bit(d.terms),
  };
}

export function buildPluginFields(d: Draft, today: string): { form: PluginForm; fields: PluginFields } {
  const phone = toE164(d.phoneCountry, d.phone) ?? "";

  if (d.variant === "weekend") {
    return {
      form: "weekend",
      fields: {
        ...common(d),
        whatsapp: phone,
        student_status: d.existing === "yes" ? "existing" : "new",
        timing_consent: bit(d.timingConsent),
        // The family's zone, so the team sees the class time as the family does.
        time_zone: d.timeZone,
        time_zone_label: d.timeZone ? zoneShort(d.timeZone) : "",
      },
    };
  }

  if (d.variant === "summer") {
    const whatsapp = d.whatsappSame ? phone : (toE164(d.whatsappCountry, d.whatsapp) ?? "");
    const help = d.summerFee === "help";
    return {
      form: "summer",
      fields: {
        ...common(d),
        enrollment_level: summerLevel(d.dob, today) ?? "",
        guardian_contact: phone,
        guardian_whatsapp: whatsapp,
        whatsapp_group: d.whatsappGroup,
        // N10 wire values. The supported rate is never offered publicly (owner correction A).
        admission_fee: d.summerFee === "standard" ? "standard" : d.summerFee === "existing" ? "complimentary" : "flexible",
        flexible_fee_note: !help
          ? ""
          : d.summerHelp === "free"
            ? "Requesting Free Enrollment"
            : `$${d.summerAmount.trim().replace(/^\$/, "")}`,
      },
    };
  }

  const course = d.courseId ? courseById(d.courseId) : null;
  const code = d.feeChoice === "code" ? (d.couponApplied?.code ?? "") : "";
  return {
    form: "free",
    fields: {
      ...common(d),
      whatsapp: phone,
      languages: d.languages,
      languages_other: d.languages.includes("other") ? d.languagesOther.trim() : "",
      is_existing_student: d.existing,
      iqu_existing_q: 1,
      course_type: course?.priceKey ?? "",
      course_variant: course?.id ?? "",
      quran_level: d.quranLevel,
      memorized: d.memorized.trim(),
      teacher_pref: d.teacherPref,
      days_per_week: d.daysPerWeek,
      preferred_days: d.days,
      session_dur: String(d.classLength),
      time_start: d.from,
      time_end: d.to,
      time_zone: d.timeZone,
      time_zone_label: namedZone(d.timeZone) ?? "OTHER",
      time_slot: d.from && d.to && d.timeZone ? timeSlotText(d.from, d.to, d.timeZone) : "",
      special_discount: bit(d.feeChoice === "pay" && d.special),
      coupon_code: code,
      zakat_declaration: bit(code !== "" && d.zakatDeclaration),
      aid_level: d.feeChoice === "help" ? d.helpLevel : "",
      aid_note: d.feeChoice === "help" ? d.helpNote.trim() : "",
      whatsapp_group: yesNo(d.whatsappGroup === "yes"),
    },
  };
}

/** Plugin field → draft field, for validation errors that come back from WordPress. */
const FIELD_OF: Record<string, string> = {
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  date_of_birth: "dob",
  age: "dob",
  guardian_name: "guardianName",
  whatsapp: "phone",
  guardian_contact: "phone",
  guardian_whatsapp: "whatsapp",
  country_res: "residence",
  country_origin: "origin",
  languages: "languages",
  languages_other: "languagesOther",
  is_existing_student: "existing",
  student_status: "existing",
  course_type: "courseId",
  course_variant: "courseId",
  course_pricing: "daysPerWeek",
  quran_level: "quranLevel",
  memorized: "memorized",
  teacher_pref: "teacherPref",
  days_per_week: "daysPerWeek",
  preferred_days: "days",
  session_dur: "classLength",
  time_slot: "from",
  time_start: "from",
  time_end: "to",
  time_zone: "timeZone",
  coupon_code: "couponCode",
  zakat_declaration: "zakatDeclaration",
  aid_level: "helpLevel",
  aid_note: "helpNote",
  admission_fee: "summerFee",
  flexible_fee_note: "summerAmount",
  enrollment_level: "dob",
  timing_consent: "timingConsent",
  referral: "referral",
  referral_other: "referralOther",
  whatsapp_group: "whatsappGroup",
  terms_accepted: "terms",
};

export function draftFieldOf(pluginField: string): string {
  return FIELD_OF[pluginField] ?? "";
}
