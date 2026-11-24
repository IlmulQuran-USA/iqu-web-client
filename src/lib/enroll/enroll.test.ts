import assert from "node:assert/strict";
import { test } from "node:test";
import { courseById } from "../../content/pricing.ts";
import { confirmationHref, parseConfirmation } from "./confirmation.ts";
import { afterHelp, allowedDays, daysError, money, payWhatYouCanError, quoteMonthly, SUMMER_STANDARD_FEE } from "./fees.ts";
import { countries } from "./options.ts";
import { parseEnrollParams } from "./params.ts";
import { phonesOf, programOf, registrationFields } from "./record.ts";
import { ageOn, draftSchema, emptyDraft, summerLevel, toE164, validateAll, validateStep, type Draft } from "./schema.ts";
import { clockLabel, namedZone, timeSlotText, windowErrors, zoneShort } from "./schedule.ts";

const TODAY = "2026-11-24";

/* ── Fee quote (PLUGIN-INVENTORY §2) ─────────────────────────────────── */

test("monthly fee is days × 4 × rate, with the Qaidah tiers", () => {
  assert.equal(quoteMonthly("noorani-qaidah", 1)?.full, 20);
  assert.equal(quoteMonthly("noorani-qaidah", 2)?.full, 40);
  assert.equal(quoteMonthly("noorani-qaidah", 3)?.full, 48); // $4 a class from 3 days
  assert.equal(quoteMonthly("quran-hifz", 3)?.full, 60);
  assert.equal(quoteMonthly("tarjumatul-quran", 2)?.full, 40);
  assert.equal(quoteMonthly("islamic-studies", 5)?.full, 80);
  assert.equal(quoteMonthly("quranic-arabic-level-1", 4)?.full, 80);
  assert.equal(quoteMonthly("noorani-qaidah", 3)?.classesPerMonth, 12);
});

test("the Special plan exists only for Qaidah / Nazirah at 3–7 days", () => {
  assert.equal(quoteMonthly("noorani-qaidah", 2)?.special, null);
  assert.equal(quoteMonthly("noorani-qaidah", 3)?.special, 40);
  assert.equal(quoteMonthly("quran-nazirah", 4)?.special, 45);
  assert.equal(quoteMonthly("quran-nazirah", 7)?.special, 85);
  assert.equal(quoteMonthly("quran-hifz", 5)?.special, null);
  assert.equal(quoteMonthly("islamic-studies", 5)?.special, null);
});

test("help amounts and money formatting", () => {
  assert.equal(afterHelp(48, "30"), 33.6);
  assert.equal(afterHelp(48, "50"), 24);
  assert.equal(afterHelp(48, "full"), 0);
  assert.equal(money(48), "$48");
  assert.equal(money(33.6), "$33.60");
  assert.equal(SUMMER_STANDARD_FEE, 40);
});

test("pay what you can: $1–$1000", () => {
  assert.equal(payWhatYouCanError("20"), undefined);
  assert.equal(payWhatYouCanError("$12.50"), undefined);
  assert.match(payWhatYouCanError("") ?? "", /Enter the amount/);
  assert.match(payWhatYouCanError("0.5") ?? "", /at least \$1/);
  assert.match(payWhatYouCanError("1001") ?? "", /up to \$1,000/);
  assert.match(payWhatYouCanError("ten") ?? "", /in dollars/);
});

/* ── Day rules per course ────────────────────────────────────────────── */

test("days per week follow each course's range", () => {
  assert.deepEqual(allowedDays(courseById("quran-hifz")), [3, 4, 5, 6, 7]);
  assert.deepEqual(allowedDays(courseById("quranic-arabic-level-1")), [4]); // owner decision 8
  assert.deepEqual(allowedDays(courseById("noorani-qaidah")), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(daysError(courseById("quran-hifz"), 2) ?? "", /at least 3/);
  assert.match(daysError(courseById("quranic-arabic-level-1"), 3) ?? "", /meets 4 days/);
  assert.equal(daysError(courseById("quranic-arabic-level-1"), 4), undefined);
  assert.match(daysError(courseById("noorani-qaidah"), 0) ?? "", /Choose/);
  assert.equal(quoteMonthly("quran-hifz", 2), null);
});

/* ── Availability window (owner decision 5) ──────────────────────────── */

test("the window must end after it starts and fit one class", () => {
  assert.deepEqual(windowErrors("16:00", "18:00", 60), {});
  assert.deepEqual(windowErrors("16:00", "16:30", 30), {});
  assert.match(windowErrors("16:00", "16:30", 40).to ?? "", /at least 40 minutes/);
  assert.match(windowErrors("18:00", "16:00", 30).to ?? "", /later than the start/);
  assert.match(windowErrors("16:00", "16:00", 30).to ?? "", /later than the start/);
  assert.match(windowErrors("", "16:00", 30).from ?? "", /earliest/);
  assert.match(windowErrors("16:10", "17:00", 30).from ?? "", /from the list/);
  assert.deepEqual(windowErrors("16:00", "16:15", 0), {}); // length not chosen yet
});

test("time labels and the plugin's time_slot text", () => {
  assert.equal(clockLabel("00:00"), "12:00 AM");
  assert.equal(clockLabel("12:15"), "12:15 PM");
  assert.equal(clockLabel("16:30"), "4:30 PM");
  assert.equal(timeSlotText("16:00", "18:00", "America/Chicago"), "4:00 PM – 6:00 PM (CT)");
});

test("time zones by their year-round names", () => {
  assert.equal(namedZone("America/New_York"), "ET");
  assert.equal(namedZone("America/Toronto"), "ET");
  assert.equal(namedZone("America/Chicago"), "CT");
  assert.equal(namedZone("America/Phoenix"), "MT"); // Arizona, no daylight saving
  assert.equal(namedZone("America/Vancouver"), "PT");
  assert.equal(namedZone("America/Halifax"), "AT");
  assert.equal(namedZone("America/Anchorage"), "AKT");
  assert.equal(namedZone("Pacific/Honolulu"), "HT");
  assert.equal(namedZone("Asia/Dhaka"), null);
  assert.equal(namedZone("America/St_Johns"), null); // Newfoundland: Other
  assert.equal(zoneShort("Asia/Dhaka", new Date("2026-11-24T12:00:00Z")), "GMT+6");
});

/* ── Query parameters ────────────────────────────────────────────────── */

test("query parameters choose the template; unknown values are ignored", () => {
  assert.deepEqual(parseEnrollParams({}), { variant: "monthly", courseId: null, aid: false });
  assert.deepEqual(parseEnrollParams({ course: "quran-hifz" }), { variant: "monthly", courseId: "quran-hifz", aid: false });
  assert.deepEqual(parseEnrollParams({ course: "made-up" }), { variant: "monthly", courseId: null, aid: false });
  assert.deepEqual(parseEnrollParams({ course: "quran-hifz", aid: "request" }), { variant: "monthly", courseId: "quran-hifz", aid: true });
  assert.deepEqual(parseEnrollParams({ aid: "yes" }), { variant: "monthly", courseId: null, aid: false });
  assert.deepEqual(parseEnrollParams({ program: "weekend-ilm-program", aid: "request" }), { variant: "weekend", courseId: null, aid: false });
  assert.deepEqual(parseEnrollParams({ program: "summer-ilm-camp", aid: "request" }), { variant: "summer", courseId: null, aid: true });
  assert.deepEqual(parseEnrollParams({ program: ["summer-ilm-camp", "x"] }).variant, "summer");
  assert.deepEqual(parseEnrollParams({ program: "unknown" }).variant, "monthly");
});

/* ── Schema and step rules ───────────────────────────────────────────── */

function complete(variant: Draft["variant"] = "monthly"): Draft {
  return {
    ...emptyDraft(variant, "0123456789abcdef0123"),
    who: "child",
    firstName: "Ayesha",
    lastName: "Rahman",
    dob: "2017-03-09",
    guardianName: "Sadia Rahman",
    email: "parent@example.com",
    phoneCountry: "US",
    phone: "(214) 555-0123",
    residence: "US",
    origin: "BD",
    languages: ["english", "bengali"],
    existing: "no",
    courseId: "noorani-qaidah",
    quranLevel: "no_letters",
    teacherPref: "female",
    timeZone: "America/Chicago",
    daysPerWeek: 3,
    days: ["monday", "wednesday", "friday"],
    classLength: 30,
    from: "16:00",
    to: "18:00",
    feeChoice: "pay",
    timingConsent: true,
    summerFee: "standard",
    referral: "friend_family",
    whatsappGroup: "yes",
    terms: true,
  };
}

test("a complete monthly draft passes every step and the schema", () => {
  const d = complete();
  assert.equal(validateAll(d, TODAY), null);
  assert.equal(draftSchema.safeParse(d).success, true);
});

test("the schema refuses unknown values and long text", () => {
  assert.equal(draftSchema.safeParse({ ...complete(), courseId: "made-up" }).success, false);
  assert.equal(draftSchema.safeParse({ ...complete(), quranLevel: "beginner" }).success, false);
  assert.equal(draftSchema.safeParse({ ...complete(), firstName: "x".repeat(101) }).success, false);
  assert.equal(draftSchema.safeParse({ ...complete(), submitId: "short" }).success, false);
});

test("guardian: required under 18, optional for an adult enrolling themselves", () => {
  assert.match(validateStep({ ...complete(), guardianName: "" }, "student", TODAY).guardianName ?? "", /guardian/);
  const adult = { ...complete(), who: "self" as const, dob: "1990-01-01", guardianName: "" };
  assert.equal(validateStep(adult, "student", TODAY).guardianName, undefined);
});

test("ages per template", () => {
  assert.equal(ageOn("2016-11-24", TODAY), 10);
  assert.equal(ageOn("2016-11-25", TODAY), 9);
  assert.match(validateStep({ ...complete("weekend"), dob: "2012-01-01" }, "student", TODAY).dob ?? "", /5 to 12/);
  assert.match(validateStep({ ...complete("summer"), dob: "2008-01-01" }, "student", TODAY).dob ?? "", /5 to 15/);
  assert.match(validateStep({ ...complete(), dob: "2027-01-01" }, "student", TODAY).dob ?? "", /real date/);
  assert.match(validateStep({ ...complete(), dob: "2017-02-30" }, "student", TODAY).dob ?? "", /real date/);
  assert.equal(summerLevel("2018-01-01", TODAY), "level1");
  assert.equal(summerLevel("2013-01-01", TODAY), "level2");
  assert.equal(summerLevel("2023-01-01", TODAY), null);
});

test("phones: US/Canada ten digits, others with + and a country code", () => {
  assert.equal(toE164("US", "(214) 529-3544"), "+12145293544");
  assert.equal(toE164("CA", "1 416 555 0199"), "+14165550199");
  assert.equal(toE164("US", "014 555 0123"), null);
  assert.equal(toE164("US", "555-0123"), null);
  assert.equal(toE164("OTHER", "+44 20 7946 0958"), "+442079460958");
  assert.equal(toE164("OTHER", "880 1711 000000"), null); // no +
});

test("memorized: required for Hifz only (owner decision 16)", () => {
  assert.equal(validateStep({ ...complete(), memorized: "" }, "course", TODAY).memorized, undefined);
  const hifz = { ...complete(), courseId: "quran-hifz" as const, memorized: "" };
  assert.match(validateStep(hifz, "course", TODAY).memorized ?? "", /memorized/);
});

test("schedule step: days within the course range and count, window ≥ class length", () => {
  assert.match(validateStep({ ...complete(), courseId: "quran-hifz", daysPerWeek: 2 }, "schedule", TODAY).daysPerWeek ?? "", /at least 3/);
  assert.match(validateStep({ ...complete(), days: ["monday", "tuesday", "wednesday", "thursday"] }, "schedule", TODAY).days ?? "", /up to 3/);
  assert.match(validateStep({ ...complete(), classLength: 45 }, "schedule", TODAY).classLength ?? "", /class length/);
  assert.match(validateStep({ ...complete(), classLength: 60, to: "16:45" }, "schedule", TODAY).to ?? "", /at least 60/);
  assert.match(validateStep({ ...complete(), timeZone: "Mars/Olympus" }, "schedule", TODAY).timeZone ?? "", /list/);
});

test("fees step: a typed code must be applied and declared", () => {
  const typed = { ...complete(), feeChoice: "code" as const, couponCode: "QAD-260826-M4P9-100" };
  assert.match(validateStep(typed, "fees", TODAY).couponCode ?? "", /Press Apply/);
  const coupon = { code: "QAD-260826-M4P9-100", discount: 48, final: 0, percent: 100, declaration: "I sincerely confirm…" };
  assert.match(validateStep({ ...typed, couponApplied: coupon }, "fees", TODAY).zakatDeclaration ?? "", /declaration/);
  assert.deepEqual(validateStep({ ...typed, couponApplied: coupon, zakatDeclaration: true }, "fees", TODAY), {});
  assert.match(validateStep({ ...complete(), feeChoice: "help" }, "fees", TODAY).helpLevel ?? "", /how much help/);
});

test("weekend consent and summer fee rules", () => {
  assert.match(validateStep({ ...complete("weekend"), timingConsent: false }, "weekendSchedule", TODAY).timingConsent ?? "", /both classes/);
  const help = { ...complete("summer"), summerFee: "help" as const, summerHelp: "amount" as const, summerAmount: "" };
  assert.match(validateStep(help, "summerFee", TODAY).summerAmount ?? "", /amount/);
  assert.deepEqual(validateStep({ ...help, summerHelp: "free" as const }, "summerFee", TODAY), {});
});

/* ── Registration row (record.ts) ────────────────────────────────────── */

const NOW = new Date("2026-11-24T15:00:00Z");

test("monthly row: structured schedule, course variant, no stale answers", () => {
  const r = registrationFields({ ...complete(), couponCode: "OLD-CODE", special: true, helpNote: "ignored" }, TODAY, NOW);
  assert.equal(r.program, "monthly");
  assert.equal(r.courseKey, "qaidah");
  assert.equal(r.courseVariant, "noorani-qaidah");
  assert.equal(r.whatsappE164, "+12145550123");
  assert.equal(r.countryResName, "United States");
  assert.equal(r.countryResCode, "US");
  assert.equal(r.timeZone, "America/Chicago");
  assert.equal(r.timeZoneLabel, "CT");
  assert.equal(r.timeSlotText, "4:00 PM – 6:00 PM (CT)");
  assert.equal(r.timeStart, "16:00");
  assert.equal(r.sessionMinutes, 30);
  assert.equal(r.existingStudent, false); // N6: "No" is stored too
  assert.equal(r.aidLevel, null); // fee choice is "pay": no help fields
  assert.equal(r.aidNote, null);
  assert.equal(r.ageAtSignup, 9);
  assert.equal(r.termsAcceptedAt, NOW);
  assert.equal("couponId" in r, false); // money and coupons are decided by the server, not the draft
});

test("help request row", () => {
  const r = registrationFields({ ...complete(), feeChoice: "help", helpLevel: "45", helpNote: " Two children " }, TODAY, NOW);
  assert.equal(r.aidLevel, "45");
  assert.equal(r.aidNote, "Two children");
});

test("summer row: level from DOB, never the supported rate", () => {
  const base = { ...complete("summer"), dob: "2018-05-01" };
  assert.equal(programOf(base, TODAY), "summer_l1");
  assert.equal(programOf({ ...base, dob: "2013-05-01" }, TODAY), "summer_l2");
  assert.equal(registrationFields(base, TODAY, NOW).admissionFee, "standard");
  assert.equal(registrationFields({ ...base, summerFee: "existing" }, TODAY, NOW).admissionFee, "complimentary");
  const free = registrationFields({ ...base, summerFee: "help", summerHelp: "free" }, TODAY, NOW);
  assert.equal(free.admissionFee, "flexible");
  assert.equal(free.flexibleFeeNote, "Requesting Free Enrollment");
  const amount = registrationFields({ ...base, summerFee: "help", summerHelp: "amount", summerAmount: "$20" }, TODAY, NOW);
  assert.equal(amount.flexibleFeeNote, "$20");
  assert.equal(registrationFields(base, TODAY, NOW).guardianWhatsappE164, "+12145550123"); // same as contact
  assert.deepEqual(phonesOf({ ...base, whatsappSame: false, whatsappCountry: "OTHER", whatsapp: "+44 20 7946 0958" }), ["+12145550123", "+442079460958"]);
});

test("weekend row: program from the student question, timing consent stored with its time (N9)", () => {
  const d = { ...complete("weekend"), existing: "yes" as const };
  assert.equal(programOf(d, TODAY), "weekend_existing");
  const r = registrationFields(d, TODAY, NOW);
  assert.equal(r.timingConsentAt, NOW);
  assert.equal(r.admissionFee, "free");
  assert.equal(r.paymentStatus, "not_required");
});

test("countries: the United States and Canada first", () => {
  const list = countries();
  assert.equal(list[0].code, "US");
  assert.equal(list[1].code, "CA");
  assert.ok(list.some((c) => c.code === "BD" && c.name === "Bangladesh"));
  assert.ok(list.length > 200);
});

/* ── Confirmation URL ────────────────────────────────────────────────── */

test("confirmation URLs carry no personal data and parse back", () => {
  const href = confirmationHref("aid", "IQU-482", { eventId: "abc12345-ef", value: 48, contentName: "Free Enrollment" });
  assert.equal(href, "/enroll/confirmation?s=aid&ref=IQU-482&eid=abc12345-ef&v=48&cn=Free+Enrollment");
  const parsed = parseConfirmation(Object.fromEntries(new URL(href, "https://x").searchParams));
  assert.deepEqual(parsed, { state: "aid", reference: "IQU-482", lead: { eventId: "abc12345-ef", value: 48, contentName: "Free Enrollment" } });
  assert.deepEqual(parseConfirmation({ s: "hack", ref: "<script>", eid: "x", cn: "Other" }), { state: "review", reference: null, lead: null });
});

test("dates display as 9 Mar 2017 (CLAUDE.md §4)", async () => {
  const { displayDate } = await import("./schema.ts");
  assert.equal(displayDate("2017-03-09"), "9 Mar 2017");
  assert.equal(displayDate("2017-02-30"), "");
});
