/*
 * Option lists for /enroll: one source for the form, the review summary and
 * the payload sent to the iqu-registration plugin. Values are the plugin's
 * stored values (or the new ones listed in F:/iqu-setup/reports/
 * enroll-plugin-changes.md); labels follow the site's voice and spelling
 * (Quran, enrollment: PRODUCT.md, owner 21 and 24 Nov 2026).
 *
 * Pure data and helpers, no React: imported by client components, the server
 * action and the unit tests (node --test), hence the relative .ts imports.
 */

export type Choice<V extends string = string> = { value: V; label: string; hint?: string };

/** Owner decision 6 (24 Nov 2026): the spec's four levels. The plugin keeps reading the old three. */
export const QURAN_LEVELS = [
  { value: "no_letters", label: "Cannot read Arabic letters yet", hint: "Starting from the alphabet." },
  { value: "qaidah", label: "Reading Qaidah", hint: "Learning letters, joining and the first rules." },
  { value: "quran", label: "Reading the Quran", hint: "Reads from the Mushaf, with or without Tajweed." },
  { value: "memorizing", label: "Memorizing the Quran", hint: "Already memorizing surahs or juz." },
] as const satisfies readonly Choice[];
export type QuranLevel = (typeof QURAN_LEVELS)[number]["value"];

/** Live plugin list (IQU_Reg_Fields::LANGUAGES) + Other with a text field (decision 15). */
export const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "arabic", label: "Arabic" },
  { value: "urdu", label: "Urdu" },
  { value: "bengali", label: "Bengali" },
  { value: "other", label: "Other" },
] as const satisfies readonly Choice[];
export type Language = (typeof LANGUAGES)[number]["value"];

/** Live plugin list (IQU_Reg_Fields::TEACHER_PREFS). */
export const TEACHER_PREFS = [
  { value: "no_preference", label: "No preference" },
  { value: "female", label: "Female teacher" },
  { value: "male", label: "Male teacher" },
] as const satisfies readonly Choice[];
export type TeacherPref = (typeof TEACHER_PREFS)[number]["value"];

/** Live plugin list (IQU_Reg_Fields::REFERRALS) + Other with a text field (N3). */
export const REFERRALS = [
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Our website" },
  { value: "friend_family", label: "A friend or family member" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const satisfies readonly Choice[];
export type Referral = (typeof REFERRALS)[number]["value"];

/** Week order Monday first (the site's timetables). Values are the plugin's lowercase day names. */
export const WEEKDAYS = [
  { value: "monday", label: "Monday", short: "Mon" },
  { value: "tuesday", label: "Tuesday", short: "Tue" },
  { value: "wednesday", label: "Wednesday", short: "Wed" },
  { value: "thursday", label: "Thursday", short: "Thu" },
  { value: "friday", label: "Friday", short: "Fri" },
  { value: "saturday", label: "Saturday", short: "Sat" },
  { value: "sunday", label: "Sunday", short: "Sun" },
] as const;
export type Weekday = (typeof WEEKDAYS)[number]["value"];

/** Help with the monthly fee (decision 2): the owner's scale, PRODUCT.md "Positioning". */
export const HELP_LEVELS = [
  { value: "30", label: "30% off", percent: 30 },
  { value: "45", label: "45% off", percent: 45 },
  { value: "50", label: "50% off", percent: 50 },
  { value: "full", label: "A full scholarship", percent: 100 },
] as const;
export type HelpLevel = (typeof HELP_LEVELS)[number]["value"];

export function labelOf(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? "";
}

/* ── Countries (decision 14: a list, the United States and Canada first) ── */

// ISO 3166-1 alpha-2. Names come from Intl.DisplayNames, so they stay correct
// and need no translation table here.
const ISO =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW";

export type Country = { code: string; name: string };

let countryCache: Country[] | null = null;

/** United States, Canada, then every other country A–Z by English name. */
export function countries(): Country[] {
  if (countryCache) return countryCache;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const name = (code: string) => names.of(code) ?? code;
  const rest = ISO.split(" ")
    .map((code) => ({ code, name: name(code) }))
    .filter((c) => c.name !== c.code)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  countryCache = [{ code: "US", name: name("US") }, { code: "CA", name: name("CA") }, ...rest];
  return countryCache;
}

export function countryName(code: string): string {
  return countries().find((c) => c.code === code)?.name ?? "";
}
