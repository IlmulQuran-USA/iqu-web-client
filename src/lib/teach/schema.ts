import { monthlyCourses, programs } from "../../content/pricing.ts";

/*
 * The /teach application: fields and rules, one source for the browser (blur
 * and submit checks) and the server action, so both say the same thing.
 *
 * The live /instructor-registration page had no form (inventory, 27 Nov 2026:
 * it shows the unrendered Tutor LMS shortcode), so there were no live fields
 * to carry over. The owner chose spec §7.16's application without the file
 * upload (27 Nov 2026); a recitation sample is a link instead.
 */

/** The courses and programs the site teaches (pricing.ts), as the applicant can offer them. */
export const COURSE_OPTIONS = [
  ...monthlyCourses.map((c) => ({ value: c.id as string, label: c.label })),
  ...Object.values(programs).map((p) => ({ value: p.id as string, label: p.label })),
] as const;

/** The teaching languages the site states (courses.ts courseRules.languages, live). */
export const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "bengali", label: "Bengali" },
  { value: "arabic", label: "Arabic" },
  { value: "urdu", label: "Urdu" },
] as const;

export const QUALIFICATIONS = [
  { value: "hafez", label: "Hafez or Hafezah (memorized the whole Quran)" },
  { value: "alim", label: "Alim or Alimah" },
  { value: "mufti", label: "Mufti (Ifta)" },
  { value: "other", label: "Other" },
] as const;

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

export const MAX = { short: 100, country: 60, other: 200, ijazah: 300, availability: 1000, references: 1000, long: 2000, url: 500 } as const;

export type TeachInput = {
  name: string;
  email: string;
  phone: string;
  country: string;
  gender: string;
  courses: string[];
  languages: string[];
  qualifications: string[];
  qualificationOther: string;
  ijazah: string;
  ijazahDetail: string;
  experience: string;
  availability: string;
  timeZone: string;
  sampleUrl: string;
  references: string;
  message: string;
};
export type TeachField = keyof TeachInput;
export type TeachErrors = Partial<Record<TeachField, string>>;

export const EMPTY: TeachInput = {
  name: "",
  email: "",
  phone: "",
  country: "",
  gender: "",
  courses: [],
  languages: [],
  qualifications: [],
  qualificationOther: "",
  ijazah: "",
  ijazahDetail: "",
  experience: "",
  availability: "",
  timeZone: "",
  sampleUrl: "",
  references: "",
  message: "",
};

/** The order fields appear on the page (the error summary follows it). */
export const FIELD_ORDER: TeachField[] = [
  "name",
  "email",
  "phone",
  "country",
  "gender",
  "courses",
  "languages",
  "qualifications",
  "qualificationOther",
  "ijazah",
  "ijazahDetail",
  "experience",
  "availability",
  "timeZone",
  "sampleUrl",
  "references",
  "message",
];

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const text = (v: string | string[]) => (Array.isArray(v) ? "" : v);
const list = (v: string | string[]) => (Array.isArray(v) ? v : []);
const inList = (options: readonly { value: string }[], v: string) => options.some((o) => o.value === v);
const required = (what: string, max: number) => (v: string | string[]) => {
  const s = text(v).trim();
  return !s ? what : s.length > max ? `Keep this under ${max.toLocaleString("en-US")} characters.` : undefined;
};
const optional = (max: number) => (v: string | string[]) => (text(v).length > max ? `Keep this under ${max.toLocaleString("en-US")} characters.` : undefined);
const pick = (options: readonly { value: string }[], what: string) => (v: string | string[]) => {
  const values = list(v);
  return !values.length ? what : values.every((x) => inList(options, x)) ? undefined : what;
};

/** Each check gets the value and the whole form (for the fields that depend on another). */
export const checks: Record<TeachField, (v: string | string[], all: TeachInput) => string | undefined> = {
  name: required("Enter your full name.", MAX.short),
  email: (v) => {
    const s = text(v).trim();
    return !s ? "Enter your email address." : s.length > 254 || !EMAIL.test(s) ? "Enter an email address in the format name@example.com." : undefined;
  },
  phone: (v) => {
    const s = text(v).trim();
    return !s ? "Enter your WhatsApp number." : s.replace(/\D/g, "").length < 7 || s.length > 40 ? "Enter your WhatsApp number with its country code." : undefined;
  },
  country: required("Enter the country you live in.", MAX.country),
  gender: (v) => (inList(GENDERS, text(v)) ? undefined : "Choose male or female."),
  courses: pick(COURSE_OPTIONS, "Choose at least one course you can teach."),
  languages: pick(LANGUAGES, "Choose at least one language you can teach in."),
  qualifications: pick(QUALIFICATIONS, "Choose at least one qualification."),
  qualificationOther: (v, all) => (all.qualifications.includes("other") ? required("Write your other qualification.", MAX.other)(v) : optional(MAX.other)(v)),
  ijazah: (v) => (inList(YES_NO, text(v)) ? undefined : "Choose yes or no."),
  ijazahDetail: (v, all) => (all.ijazah === "yes" ? required("Write from whom, and for which recitation.", MAX.ijazah)(v) : optional(MAX.ijazah)(v)),
  experience: required("Describe your teaching experience.", MAX.long),
  availability: required("Write the days and hours you can teach.", MAX.availability),
  timeZone: required("Enter the city or time zone you will teach from.", MAX.short),
  sampleUrl: (v) => {
    const s = text(v).trim();
    if (!s) return undefined;
    if (s.length > MAX.url) return `Keep the link under ${MAX.url} characters.`;
    try {
      return new URL(s).protocol === "https:" ? undefined : "Enter a link that starts with https://.";
    } catch {
      return "Enter a link that starts with https://.";
    }
  },
  references: optional(MAX.references),
  message: optional(MAX.long),
};

export function validateTeach(input: TeachInput): TeachErrors {
  const errors: TeachErrors = {};
  for (const field of FIELD_ORDER) {
    const message = checks[field](input[field] ?? (Array.isArray(EMPTY[field]) ? [] : ""), input);
    if (message) errors[field] = message;
  }
  return errors;
}

export const labelOf = (options: readonly { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value;
export const labelsOf = (options: readonly { value: string; label: string }[], values: string[]) => values.map((v) => labelOf(options, v)).join(", ");
