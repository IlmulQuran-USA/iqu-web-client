import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { idempotency, registrations } from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import { toCents } from "../../money.ts";
import { siteYmd } from "../dhaka.ts";
import { country, e164 } from "../migrate/values.ts";
import { BOM, csvLine, csvSafe, parseCsv } from "./csv.ts";

/*
 * Bulk import of current students (day 1, owner: Resolved facts), ported rule
 * for rule from the live plugin 3.7.20:
 *   IM = admin/billing/class-iqu-billing-import.php
 *   AS = admin/billing/class-iqu-billing-add-student.php (prepare / clean_extra: the same rules as the single form)
 *   P  = includes/class-iqu-pricing.php, RF = includes/class-iqu-reg-fields.php, D = includes/class-iqu-dob.php
 *
 * Two steps, as the plugin: checkFile() reads and checks every row and writes
 * nothing (the preview, also "Validate only"); confirm() writes the rows that
 * passed, after checking each again. Every imported student is an existing
 * student with created_via "import": no free month (owner Q13; AS:422-423).
 * The admin page that uploads, previews and confirms is P3; this module is
 * its whole logic. Excel (.xlsx) reading is P3 as well (CSV here).
 */

/* ── The plugin's lists (values read from the live site, 25 Nov 2026) ── */

/** IQU_Pricing::COURSES (P): key, short code, label, aliases. */
export const COURSES = [
  { key: "qaidah", short: "QAD", label: "Qa'idah / Nazirah", minDays: 1, aliases: [] as string[] },
  { key: "hifz", short: "HFZ", label: "Quran Hifz", minDays: 3, aliases: [] },
  { key: "arabic", short: "ARB", label: "Arabic Language", minDays: 1, aliases: [] },
  { key: "tarjumatul_quran", short: "TRJ", label: "Tarjumatul Quran", minDays: 1, aliases: ["tarjumatul quran", "tarjamatul quran", "tarjumatul qur'an", "tarjuma", "quran translation"] },
  { key: "islamic_studies", short: "ISL", label: "Islamic Studies", minDays: 1, aliases: ["islamic studies", "islamic study"] },
] as const;
const TIERS: Record<string, [number, number][]> = {
  qaidah: [[2, 5], [7, 4]],
  hifz: [[7, 5]],
  arabic: [[7, 5]],
  tarjumatul_quran: [[7, 5]],
  islamic_studies: [[2, 5], [7, 4]],
};
const COURSE_KEYS = COURSES.map((c) => c.key);
const QURAN_LEVELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
const LANGUAGES = ["english", "arabic", "urdu", "bengali"];
const WEEK_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SESSION_DURATIONS = ["30", "40", "50", "60"];
const TEACHER_PREFS = ["male", "female", "no_preference"];
const REFERRALS: Record<string, string> = { facebook: "Facebook", whatsapp: "WhatsApp", linkedin: "LinkedIn", youtube: "YouTube", website: "Website", friend_family: "Friend/Family", email: "Email" };
const EXTRA_FIELDS = { country_origin: 100, country_res: 100, memorized: 500, time_slot: 100 };
const AGREED_MAX = 5000;
const DOB_MIN_AGE = 4;
const DOB_MAX_AGE = 100;
const MAX_BYTES = 1048576; // IM:40
const MAX_ROWS = 500; // IM:41
const KEEP_MS = 3_600_000; // IM:47

/** "qaidah, hifz, arabic, tarjumatul_quran or islamic_studies" (P:155-160). */
export const courseListText = () => `${COURSE_KEYS.slice(0, -1).join(", ")} or ${COURSE_KEYS[COURSE_KEYS.length - 1]}`;
/** "30, 40, 50 or 60" (RF:61-66). */
export const durationListText = () => `${SESSION_DURATIONS.slice(0, -1).join(", ")} or ${SESSION_DURATIONS[SESSION_DURATIONS.length - 1]}`;
/** IQU_Pricing::format: '$' . number_format($x, 2). */
const usd = (dollars: number) => `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** IQU_Pricing::calculate (P:220-264) in dollars. */
function calculate(course: string, days: number): { valid: true; monthly: number; rate: number } | { valid: false; error: string } {
  const c = COURSES.find((x) => x.key === course);
  if (!c) return { valid: false, error: "Please select a valid course." };
  if (days < c.minDays) return { valid: false, error: `${c.label} requires a minimum of ${c.minDays} ${c.minDays === 1 ? "class" : "classes"} per week.` };
  if (days > 7) return { valid: false, error: "Please select no more than 7 days per week." };
  const rate = TIERS[course].find(([upTo]) => days <= upTo)![1];
  return { valid: true, monthly: r2(days * 4 * rate), rate };
}

/* ── Columns and the sample file (IM:57-97, IM:138-153) ─────────────── */

/** [name, required, help, example] — IM:58-81 with {courses} / {durations} filled in (IM:50-55). */
export const COLUMNS: readonly [string, boolean, string, string][] = [
  ["First Name", true, "Student first name.", "Ayesha"],
  ["Last Name", true, "Student last name.", "Khan"],
  ["Guardian", false, "Parent or guardian. Leave empty for adult students.", "Sara Khan"],
  ["Email", true, "Billing email. The payment link and receipts go here. Siblings may share one.", "sara.k@example.com"],
  ["WhatsApp", true, "With country code. If empty, Guardian WhatsApp is used.", "+1 214 555 0148"],
  ["Guardian WhatsApp", false, "Used when WhatsApp is empty.", ""],
  [
    "Course",
    true,
    `${courseListText()} (the full course name also works). If the cell is empty or the course is not on the website, the student is still imported with a warning and the course left blank; billing waits until you set it.`,
    COURSE_KEYS[0],
  ],
  ["Days/Week", true, "Classes per week, 1 to 7. Hifz needs at least 3.", "4"],
  [
    "Agreed Monthly Fee",
    false,
    "A monthly fee agreed with the family, billed exactly as entered (lower or higher than the standard fee). Number only. 0 means full scholarship. Leave empty for the standard fee. Without a recognised course it is saved with a warning and compared with the standard price once the course is set.",
    "",
  ],
  ["Zakat", false, "Yes if the reduced fee is paid by the Zakat Fund. Otherwise leave empty or No.", "No"],
  ["Date of Birth", false, "Student date of birth: 2016-03-04 (year-month-day) or 3/4/2016 (month first). Age 4 to 100. A file with an Age column instead still works.", "2016-03-04"],
  ["Country Origin", false, "Country the student is from.", "Bangladesh"],
  ["Country Residence", false, "Country the student lives in.", "United States"],
  ["Quran Level", false, "Beginner, Intermediate or Advanced.", "Beginner"],
  ["Memorized", false, "Surahs or Juz memorized before (up to 500 characters).", "Juz Amma"],
  ["Preferred Days", false, "Days of the week, for example: Mon, Tue, Thu, Fri. No more than Days/Week.", "Mon, Tue, Thu, Fri"],
  ["Time Slot", false, "Usual class time, for example 05:00 PM – 06:00 PM (CST). Up to 100 characters.", "05:00 PM – 06:00 PM (CST)"],
  ["Session Duration", false, `${durationListText()} (minutes).`, SESSION_DURATIONS[0]],
  ["Languages", false, "English, Arabic, Urdu or Bengali; several with commas.", "English, Bengali"],
  ["Teacher Pref", false, "Male, Female or No preference.", "Female"],
  ["Referral", false, 'How they heard about us: Facebook, WhatsApp, LinkedIn, YouTube, Website, Friend/Family, Email or Other (text after "Other:" is kept; saved with a warning).', "Friend/Family"],
  ["Note", false, "Anything the admin should know.", ""],
];

/** The sample file the admin downloads (IM:138-153): BOM, header, the example row, an adult example. */
export function sampleCsv(): string {
  return (
    BOM +
    csvLine(COLUMNS.map((c) => c[0])) +
    csvLine(COLUMNS.map((c) => c[3])) +
    csvLine([
      "Omar", "Rahman", "", "omar.r@example.com", "+1 469 555 0172", "", "arabic", "2", "30", "Yes", "4/12/2002", "", "United States", "", "",
      "Sat, Sun", "10:00 AM – 11:00 AM (CST)", SESSION_DURATIONS[1], "English, Arabic", "No preference", "", "Adult student, reduced fee agreed",
    ])
  );
}

/** Normalised header → field (IM:84-97). Export column names are accepted. */
const HEADER_MAP: Record<string, string> = {
  firstname: "first_name", lastname: "last_name", guardian: "guardian_name", guardianname: "guardian_name", email: "email", whatsapp: "whatsapp",
  guardianwhatsapp: "guardian_whatsapp", course: "course", daysweek: "days", daysperweek: "days", agreedmonthlyfee: "agreed_fee", zakat: "zakat",
  zakatsupport: "zakat", declarationsigned: "zakat", age: "age", dateofbirth: "date_of_birth", dob: "date_of_birth", birthdate: "date_of_birth",
  countryresidence: "country_res", countryofresidence: "country_res", countryorigin: "country_origin", countryoforigin: "country_origin",
  quranlevel: "quran_level", memorized: "memorized", memorizedbefore: "memorized", preferreddays: "preferred_days", timeslot: "time_slot",
  sessionduration: "session_dur", languages: "languages", teacherpref: "teacher_pref", teacherpreference: "teacher_pref", referral: "referral",
  heardaboutusvia: "referral", note: "note",
};

/* ── Text helpers (WordPress sanitising, as close as plain JS allows) ── */

/** sanitize_text_field: no tags, no line breaks or tabs, single spaces, no %xx octets, trimmed. */
function sanitizeText(v: string): string {
  return v
    .replace(/<[^>]*>?/g, "")
    .replace(/%[a-f0-9]{2}/gi, "")
    .replace(/[\r\n\t ]+/g, " ")
    .trim();
}
/** sanitize_textarea_field: as above but line breaks kept. */
function sanitizeTextarea(v: string): string {
  return v
    .replace(/<[^>]*>?/g, "")
    .replace(/%[a-f0-9]{2}/gi, "")
    .replace(/[\t ]+/g, " ")
    .trim();
}
/** AS:458-465 clean_text: our own export's apostrophe and any leading formula characters removed. */
export function cleanText(value: string): string {
  let v = sanitizeText(value);
  if (v.length > 1 && v[0] === "'" && "=+-@".includes(v[1])) v = v.slice(1);
  return v.replace(/^[=+@\t\r]+/, "");
}
/** sanitize_email: only the characters an address may hold. */
function sanitizeEmail(v: string): string {
  const t = v.trim();
  const at = t.lastIndexOf("@");
  if (at < 1) return "";
  const local = t.slice(0, at).replace(/[^a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]/g, "");
  const domain = t.slice(at + 1).replace(/[^a-zA-Z0-9.-]/g, "").replace(/^[.-]+|[.-]+$/g, "");
  return local && domain.includes(".") ? `${local}@${domain}` : "";
}
/** is_email: a local part, one @, a domain with a dot and valid labels. */
function isEmail(v: string): boolean {
  return /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(v) && v.length >= 6;
}
/** sanitize_key: lower case, [a-z0-9_-] only. */
const sanitizeKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9_-]/g, "");

/** P:142-152 course_from_text, then IM:391-397: a key, short code, label or alias; else the cell as a key. */
export function normaliseCourse(value: string): string {
  const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, "");
  const v = flat(value);
  if (v === "") return "";
  for (const c of COURSES) if ([c.key, c.short, c.label, ...c.aliases].some((n) => flat(n) === v)) return c.key;
  return sanitizeKey(value);
}

/* ── Dates of birth (AS:446-452; D) ──────────────────────────────────── */

const realDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function parseDob(value: string): string {
  const v = value.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]00:00(?::00)?)?$/.exec(v);
  if (m) return realDate(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : "";
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return realDate(+m[3], +m[1], +m[2]) ? iso(+m[3], +m[1], +m[2]) : "";
  return "";
}

/** D:78-92 age_on: whole years; 29 Feb becomes 28 Feb in a year without it. */
export function ageOn(dob: string, on: string): number {
  const y = Number(on.slice(0, 4));
  const [, m, d] = dob.split("-").map(Number);
  const day = m === 2 && d === 29 && !realDate(y, 2, 29) ? 28 : d;
  const birthday = iso(y, m, day);
  const age = y - Number(dob.slice(0, 4));
  return on < birthday ? age - 1 : age;
}

/* ── One row → the single form's input (IM:343-388) ─────────────────── */

export type Input = {
  first_name: string;
  last_name: string;
  guardian_name: string;
  email: string;
  whatsapp: string;
  course: string;
  course_raw: string;
  days: number;
  use_agreed: boolean;
  agreed_fee: number;
  agreed_fee_invalid: boolean;
  zakat: boolean;
  note: string;
  extra: Record<string, string>;
};

export function toInput(r: Record<string, string>): Input {
  let wa = r.whatsapp ?? "";
  if (wa === "") wa = r.guardian_whatsapp ?? "";
  wa = wa.replace(/[^0-9+\-\s()]/g, "").slice(0, 25).trim();
  const feeCell = (r.agreed_fee ?? "").trim();
  const feeBad = feeCell !== "" && !/^(-\s*\$?|\$\s*-?)?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?\s*(usd)?$/i.test(feeCell);
  const feeRaw = feeBad ? "" : feeCell.replace(/[^0-9.-]/g, "");
  const zak = (r.zakat ?? "").toLowerCase();
  return {
    first_name: cleanText(r.first_name ?? ""),
    last_name: cleanText(r.last_name ?? ""),
    guardian_name: cleanText(r.guardian_name ?? ""),
    email: sanitizeEmail(r.email ?? ""),
    whatsapp: wa,
    course: normaliseCourse(r.course ?? ""),
    course_raw: cleanText(r.course ?? ""),
    days: Number((r.days ?? "").replace(/\D/g, "") || 0),
    use_agreed: feeCell !== "",
    agreed_fee: feeRaw !== "" ? Number.parseFloat(feeRaw) || 0 : 0,
    agreed_fee_invalid: feeBad,
    zakat: ["yes", "y", "true", "1"].includes(zak),
    note: sanitizeTextarea(r.note ?? ""),
    extra: {
      date_of_birth: r.date_of_birth ?? "",
      age: r.age ?? "",
      country_origin: r.country_origin ?? "",
      country_res: r.country_res ?? "",
      quran_level: r.quran_level ?? "",
      memorized: r.memorized ?? "",
      languages: r.languages ?? "",
      preferred_days: r.preferred_days ?? "",
      time_slot: r.time_slot ?? "",
      session_dur: r.session_dur ?? "",
      teacher_pref: r.teacher_pref ?? "",
      referral: r.referral ?? "",
    },
  };
}

/* ── clean_extra (AS:176-289), CSV variant ──────────────────────────── */

export type Extra = {
  date_of_birth?: string;
  age?: number;
  country_origin?: string;
  country_res?: string;
  quran_level?: string;
  memorized?: string;
  languages?: string[];
  preferred_days?: string[];
  time_slot?: string;
  session_dur?: number;
  teacher_pref?: string;
  referral?: string;
  referral_other?: string;
};

const listOf = (v: string) =>
  v
    .split(/[,;/|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function cleanExtra(x: Record<string, string>, days: number, today: string): [Extra, string[], string[]] {
  const cols: Extra = {};
  const e: string[] = [];
  const w: string[] = [];

  const dobRaw = (x.date_of_birth ?? "").trim();
  if (dobRaw !== "") {
    const dob = parseDob(dobRaw);
    if (dob === "" || dob > today) e.push("Date of Birth must be a real date in the past, for example 2016-03-04 or 3/4/2016 (month first).");
    else {
      const years = ageOn(dob, today);
      if (years < DOB_MIN_AGE || years > DOB_MAX_AGE) e.push(`Age must be between ${DOB_MIN_AGE} and ${DOB_MAX_AGE}.`);
      else {
        cols.date_of_birth = dob;
        cols.age = years;
      }
    }
  }
  const age = (x.age ?? "").trim();
  if (dobRaw === "" && age !== "" && age !== "0") {
    if (!/^\d{1,3}$/.test(age) || Number(age) < 1 || Number(age) > 100) e.push("Age must be a number from 1 to 100.");
    else {
      cols.age = Number(age);
      if (Number(age) < 4) w.push("Age under 4 — please confirm.");
    }
  }
  for (const k of ["country_origin", "country_res"] as const) {
    const v = cleanText(x[k] ?? "");
    if (v !== "") cols[k] = [...v].slice(0, EXTRA_FIELDS[k]).join("");
  }
  const lvl = (x.quran_level ?? "").trim().toLowerCase();
  if (lvl !== "") {
    if (!(lvl in QURAN_LEVELS)) e.push("Qur'an level must be Beginner, Intermediate or Advanced.");
    else cols.quran_level = lvl;
  }
  const mem = sanitizeTextarea(x.memorized ?? "");
  if (mem !== "") cols.memorized = [...mem.replace(/^[=+@\t\r]+/, "")].slice(0, EXTRA_FIELDS.memorized).join("");

  let langs = listOf(x.languages ?? "");
  if (langs.length) {
    langs = langs.map((l) => (l === "bangla" ? "bengali" : l));
    if (langs.some((l) => !LANGUAGES.includes(l))) e.push("Languages must be English, Arabic, Urdu or Bengali.");
    else cols.languages = [...new Set(langs)];
  }

  const want = listOf(x.preferred_days ?? "");
  if (want.length) {
    const by3 = new Map(WEEK_DAYS.map((d) => [d.slice(0, 3).toLowerCase(), d.toLowerCase()]));
    const clean: string[] = [];
    let bad = false;
    for (const d of want) {
      const full = by3.get(d.slice(0, 3));
      if (full && (d.length === 3 || d === full)) clean.push(full);
      else bad = true;
    }
    const unique = [...new Set(clean)];
    if (bad) e.push("Preferred days must be days of the week (for example Mon, Wed).");
    else if (days >= 1 && unique.length > days) e.push("Choose no more preferred days than classes a week.");
    else cols.preferred_days = unique;
  }

  const slot = cleanText(x.time_slot ?? "");
  // The single form's start / end / zone fields (AS:244-251) are not CSV columns: the text is kept (AS:252-254).
  if (slot !== "") cols.time_slot = [...slot].slice(0, EXTRA_FIELDS.time_slot).join("");

  const dur = (x.session_dur ?? "").trim().toLowerCase();
  if (dur !== "") {
    const num = dur.replace(/\D/g, "");
    if (!SESSION_DURATIONS.includes(num)) e.push(`Session duration must be ${durationListText()} minutes.`);
    else cols.session_dur = Number(num);
  }

  let tp = (x.teacher_pref ?? "").replace(/[\s-]+/g, "_").toLowerCase().replace(/^_+|_+$/g, "");
  if (tp !== "") {
    if (["any", "either", "none", "no_pref"].includes(tp)) tp = "no_preference";
    if (!TEACHER_PREFS.includes(tp)) e.push("Teacher preference must be Male, Female or No preference.");
    else cols.teacher_pref = tp;
  }

  const refCell = x.referral ?? "";
  let ref = refCell.trim().toLowerCase();
  const om = /^\s*other\b\s*[:\-–(]?\s*(.*?)\)?\s*$/iu.exec(refCell);
  if (om) {
    cols.referral = "other";
    cols.referral_other = [...cleanText((om[1] ?? "").trim())].slice(0, 200).join("");
    w.push("'Other' answer — check and update manually.");
    ref = "";
  }
  if (ref !== "") {
    let key = "";
    for (const [k, label] of Object.entries(REFERRALS)) {
      if (ref === k || ref === label.toLowerCase() || ref.replace(/[^a-z]/g, "") === k.replace(/[^a-z]/g, "")) key = k;
    }
    if (key === "") e.push(`How they heard about us must be one of: ${Object.values(REFERRALS).join(", ")} or Other.`);
    else cols.referral = key;
  }
  return [cols, e, w];
}

/* ── prepare (AS:299-439), CSV variant ──────────────────────────────── */

export type Prepared = {
  errors: string[];
  warnings: string[];
  row: typeof registrations.$inferInsert | null;
  gross: number;
  net: number;
  courseMissing: boolean;
};

export type Ctx = { db: AnyDb; now: Date; adminLogin: string };

/** AS:518-526: the same student (name + email) already enrolled in monthly classes. */
async function isDuplicate(db: AnyDb, first: string, last: string, email: string): Promise<boolean> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrations)
    .where(
      and(
        sql`lower(${registrations.firstName}) = lower(${first})`,
        sql`lower(${registrations.lastName}) = lower(${last})`,
        sql`lower(${registrations.email}) = lower(${email})`,
        eq(registrations.program, "monthly"),
      ),
    );
  return Number(r?.n ?? 0) > 0;
}

/** AS:468-477. */
function validate(i: Input, courseMissing: boolean): string[] {
  const e: string[] = [];
  if (i.first_name === "" || i.last_name === "") e.push("Enter the student's first and last name.");
  if (!isEmail(i.email)) e.push("Enter a valid email address. Payment links and receipts go here.");
  if (i.whatsapp.replace(/\D/g, "").length < 7) e.push("Enter a WhatsApp number with country code.");
  if (!courseMissing && !COURSE_KEYS.includes(i.course as (typeof COURSE_KEYS)[number])) e.push("Choose a course.");
  if (i.days < 1 || i.days > 7) e.push("Choose classes per week (1–7).");
  return e;
}

export async function prepare(input: Input, ctx: Ctx): Promise<Prepared> {
  const i = { ...input };
  const warnings: string[] = [];
  const raw = i.course_raw.trim();
  const courseMissing = !COURSE_KEYS.includes(i.course as (typeof COURSE_KEYS)[number]);
  if (courseMissing) {
    const allowed = COURSES.map((c) => `${c.label} (${c.key})`).join(", ");
    warnings.push(raw === "" ? "Course empty — left blank. Set it before billing starts." : `Course '${raw}' not found — left blank. Allowed: ${allowed}.`);
    i.course = "";
  }

  const errors = validate(i, courseMissing);
  if (i.agreed_fee_invalid) {
    errors.push("The agreed fee must be one amount, for example 30 or 30.50.");
    i.use_agreed = false;
  } else if (i.use_agreed && (!Number.isFinite(i.agreed_fee) || i.agreed_fee > AGREED_MAX)) {
    errors.push(`The agreed fee must be at most ${usd(AGREED_MAX)} a month — check the amount.`);
    i.use_agreed = false;
  }
  const today = siteYmd(ctx.now);
  const [extra, extraErrors, extraWarnings] = cleanExtra(i.extra, i.days, today);
  errors.push(...extraErrors);
  warnings.push(...extraWarnings);

  let calc: ReturnType<typeof calculate> | null = null;
  if (!errors.length && !courseMissing) {
    calc = calculate(i.course, i.days);
    if (!calc.valid) errors.push(calc.error || "Invalid course or days.");
  }
  const gross = calc && calc.valid ? calc.monthly : 0;
  let discount = 0;
  let agreed: number | null = null;
  if (!errors.length && i.use_agreed && courseMissing) {
    agreed = r2(i.agreed_fee);
    if (agreed < 0) errors.push("The agreed fee cannot be negative.");
    else warnings.push(`Agreed fee ${usd(agreed)} saved — check against the standard price once the course is set.`);
  } else if (!errors.length && i.use_agreed) {
    agreed = r2(i.agreed_fee);
    if (agreed < 0) errors.push("The agreed fee cannot be negative.");
    else {
      discount = Math.max(0, r2(gross - agreed));
      if (agreed > gross) warnings.push(`Agreed fee ${usd(agreed)} is higher than the standard fee ${usd(gross)} — check the amount.`);
    }
  }
  if (!errors.length && (await isDuplicate(ctx.db, i.first_name, i.last_name, i.email))) errors.push("Already in the enrollment records (same name and email).");

  if (errors.length) return { errors, warnings, row: null, gross, net: 0, courseMissing };

  const net = agreed !== null && !courseMissing ? agreed : r2(gross - discount);
  const res = extra.country_res ? country(extra.country_res) : { code: null, name: null };
  const origin = extra.country_origin ? country(extra.country_origin) : { code: null, name: null };
  const wa = e164(i.whatsapp);
  const note = `Imported from CSV/Excel by ${ctx.adminLogin}. ${i.note}`.trim() + (wa ? "" : `\n[WhatsApp as entered: ${i.whatsapp}]`);
  const row: typeof registrations.$inferInsert = {
    program: "monthly",
    status: "enrolled",
    createdVia: "import",
    // AS:422-423 (owner Q13): an imported student is an existing student — no free month.
    existingStudent: true,
    firstName: i.first_name,
    lastName: i.last_name,
    email: i.email,
    whatsappE164: wa,
    guardianName: i.guardian_name || null,
    guardianWhatsappE164: i.guardian_name !== "" ? wa : null,
    daysPerWeek: i.days,
    referral: extra.referral ?? null,
    referralOther: extra.referral_other ?? null,
    courseKey: i.course || null,
    perClassCents: calc && calc.valid ? toCents(calc.rate.toFixed(2)) : 0,
    calculatedCents: toCents(gross.toFixed(2)),
    discountCents: toCents(discount.toFixed(2)),
    paymentCents: toCents(net.toFixed(2)),
    zakatDeclaration: i.zakat,
    specialPlan: false,
    flexibleFeeNote: i.use_agreed ? `Agreed monthly fee ${usd(agreed ?? gross - discount)}`.slice(0, 300) : null,
    agreedFeeCents: agreed !== null ? toCents(agreed.toFixed(2)) : null,
    // AS:426-432: "Zakat: Yes" on a reduction (an agreed fee below the price, or no course yet) sets the fund to Zakat.
    agreedFeeFund: i.zakat && agreed !== null && (courseMissing || discount > 0) ? "zakat" : null,
    adminNote: note,
    dateOfBirth: extra.date_of_birth ?? null,
    ageAtSignup: extra.age ?? null,
    countryOriginCode: origin.code,
    countryOriginName: origin.name,
    countryResCode: res.code,
    countryResName: res.name,
    quranLevel: extra.quran_level ?? null,
    memorized: extra.memorized ?? null,
    languages: extra.languages ?? [],
    preferredDays: extra.preferred_days ?? [],
    timeSlotText: extra.time_slot ?? null,
    sessionMinutes: extra.session_dur ?? null,
    teacherPref: extra.teacher_pref ?? null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  return { errors: [], warnings, row, gross, net, courseMissing };
}

/* ── Step 1: read and check a file (IM:190-283) ─────────────────────── */

export type Level = "ok" | "warning" | "error";
export type PreviewRow = {
  line: number;
  in: Input;
  cells: string[];
  errors: string[];
  warnings: string[];
  level: Level;
  gross: number;
  net: number;
  courseMissing: boolean;
};
export type PreviewState = { preview: PreviewRow[]; header: string[]; file: string; key: string; dry: boolean; user: string; created: number; sha: string };

const levelOf = (errors: string[], warnings: string[]): Level => (errors.length ? "error" : warnings.length ? "warning" : "ok");

export function levelCounts(rows: PreviewRow[]): Record<Level, number> {
  const n = { ok: 0, warning: 0, error: 0 };
  for (const r of rows) n[r.level]++;
  return n;
}

/** IM:159-176 + IM:190-283. `bytes` is the uploaded file; nothing is written. */
export async function checkFile(bytes: Uint8Array, name: string, ctx: Ctx & { user: string; dry?: boolean }): Promise<{ error: string } | PreviewState> {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_BYTES) return { error: "The file must be a CSV or Excel (.xlsx) file under 1 MB." };
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "xlsx"].includes(ext)) {
    return { error: 'Please upload a .csv or .xlsx file. In Excel or Google Sheets use "Save as / Download as" CSV or Excel (.xlsx).' };
  }
  if (ext === "xlsx") return { error: "Excel (.xlsx) files open with the new admin page (P3). For now save the sheet as CSV and upload that." };

  const records = parseCsv(new TextDecoder("utf-8").decode(bytes));
  const header = records[0]?.[1];
  if (!header || (header.length === 1 && header[0] === "" && records.length === 1)) return { error: "The file is empty." };

  const map = new Map<number, string>();
  header.forEach((h, i) => {
    const norm = h.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const field = HEADER_MAP[norm];
    if (field && ![...map.values()].includes(field)) map.set(i, field);
  });
  const fields = [...map.values()];
  const missing: string[] = [];
  for (const [field, label] of [["first_name", "First Name"], ["last_name", "Last Name"], ["email", "Email"], ["course", "Course"], ["days", "Days/Week"]]) {
    if (!fields.includes(field)) missing.push(label);
  }
  if (!fields.includes("whatsapp") && !fields.includes("guardian_whatsapp")) missing.push("WhatsApp");
  if (missing.length) return { error: `These columns are missing: ${missing.join(", ")}. Use the sample file as a guide.` };

  const rows: PreviewRow[] = [];
  const seen = new Map<string, number>();
  for (let n = 1; n < records.length; n++) {
    const cells = records[n][1];
    const line = n + 1; // fgetcsv's record counter: the header is line 1 (IM:214-215)
    if (cells.every((c) => c.trim() === "")) continue;
    if (rows.length >= MAX_ROWS) return { error: `The file has more than ${MAX_ROWS} students. Split it into smaller files.` };
    const raw: Record<string, string> = {};
    for (const [i, field] of map) raw[field] = (cells[i] ?? "").trim();
    const input = toInput(raw);
    const prep = await prepare(input, ctx);
    const key = `${input.first_name}|${input.last_name}|${input.email}`.toLowerCase();
    if (!prep.errors.length && seen.has(key)) prep.errors.push(`Same student appears twice in this file (row ${seen.get(key)}).`);
    if (!seen.has(key)) seen.set(key, line);
    const warnings = prep.errors.length ? [] : prep.warnings;
    rows.push({ line, in: input, cells: cells.map(String), errors: prep.errors, warnings, level: levelOf(prep.errors, warnings), gross: prep.gross, net: prep.net, courseMissing: prep.courseMissing });
  }
  if (!rows.length) return { error: "No students found in the file." };
  return {
    preview: rows,
    header,
    file: name.replace(/[^A-Za-z0-9._-]/g, "-"),
    key: randomBytes(15).toString("base64url").slice(0, 20),
    dry: Boolean(ctx.dry),
    user: ctx.user,
    created: ctx.now.getTime(),
    sha: createHash("sha256").update(bytes).digest("hex"),
  };
}

/* ── Step 2: import (IM:403-472) ─────────────────────────────────────── */

export type Done = { added: number; billed: number; warned: number; noCourse: number; failed: string[]; skipped: { line: number; name: string; errors: string[] }[]; levels: Record<number, Level>; ids: number[] };

export async function confirm(state: PreviewState, key: string, ctx: Ctx & { user: string }): Promise<{ error: string } | { done: Done }> {
  if (!state.preview?.length || state.key !== key) return { error: "This preview has expired. Please upload the file again." };
  if (state.user !== ctx.user) return { error: "This checked file belongs to another user. Please upload the file again." };
  if (ctx.now.getTime() - state.created > KEEP_MS) return { error: "The checked file has expired (it is kept for 1 hour). Please upload it again." };
  if (state.dry) {
    for (const r of state.preview) {
      const now = await prepare(r.in, ctx);
      if (levelOf(now.errors, now.warnings) !== r.level && !r.errors.length) {
        return { error: `Something changed since the file was checked (row ${r.line}). Nothing was imported. Please upload the file again to check it.` };
      }
    }
  }
  // One import per checked file (IM:438-444): a second click or tab finds the claim.
  const claimKey = `import-${createHash("sha256").update(state.key).digest("hex").slice(0, 40)}`;
  const claimed = await ctx.db
    .insert(idempotency)
    .values({ key: claimKey, state: "running", createdAt: ctx.now, expiresAt: new Date(ctx.now.getTime() + KEEP_MS) })
    .onConflictDoNothing()
    .returning({ key: idempotency.key });
  if (!claimed.length) return { error: "This file is already being imported. Check Student Billing in a moment, and upload it again only if the students are missing." };

  const done: Done = { added: 0, billed: 0, warned: 0, noCourse: 0, failed: [], skipped: [], levels: {}, ids: [] };
  for (const r of state.preview) {
    if (r.errors.length) {
      done.skipped.push({ line: r.line, name: `${r.in.first_name} ${r.in.last_name}`.trim(), errors: r.errors });
      done.levels[r.line] = "error";
      continue;
    }
    const prep = await prepare(r.in, ctx); // check again: records may have changed
    if (prep.errors.length || !prep.row) {
      done.failed.push(`Row ${r.line}: ${prep.errors.join(" ")}`);
      done.levels[r.line] = "error";
      continue;
    }
    let id: number | null = null;
    try {
      [{ id }] = await ctx.db.insert(registrations).values(prep.row).returning({ id: registrations.id });
    } catch {
      id = null;
    }
    if (!id) {
      done.failed.push(`Row ${r.line}: could not be saved.`);
      done.levels[r.line] = "error";
      continue;
    }
    done.ids.push(id);
    done.added++;
    done.levels[r.line] = levelOf([], prep.warnings);
    if (prep.warnings.length) done.warned++;
    if (prep.courseMissing) done.noCourse++;
    else if (prep.net > 0) done.billed++;
  }
  await ctx.db.update(idempotency).set({ state: "done", response: { added: done.added } }).where(eq(idempotency.key, claimKey));
  return { done };
}

/* ── The results file (IM:303-334) ──────────────────────────────────── */

export function resultsCsv(state: PreviewState): string {
  const width = state.header.length;
  const label: Record<Level, string> = { ok: "OK", warning: "WARNING", error: "ERROR" };
  let out = BOM + csvLine([...state.header.map(csvSafe), "result", "messages"]);
  for (const r of state.preview) {
    const cells = [...r.cells, ...Array(Math.max(0, width - r.cells.length)).fill("")].slice(0, width);
    out += csvLine([...cells.map(csvSafe), label[r.level], csvSafe([...r.errors, ...r.warnings].join(" | "))]);
  }
  return out;
}
