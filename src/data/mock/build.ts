import { courseById, monthlyFee, type CourseId } from "../../content/pricing.ts";
import { instantAt } from "../../lib/time-zone.ts";
import type { BillingAccount, BillingLine, BillingStatus, Fund, HelpLevel, Payment } from "../contracts/billing.ts";
import type { Account, Family, Student, Teacher } from "../contracts/people.ts";
import type { Registration, RegistrationStatus } from "../contracts/registrations.ts";
import { statusFromOverlap, type AttendanceStatus, type ClassSession, type Thresholds } from "../contracts/schedule.ts";
import { ACCOUNTS, ADULT_MEN, ADULT_WOMEN, BOYS, GIRLS, PLACES, SURNAMES, TEACHERS } from "./cast.ts";
import { hash, int, pick, rng, SEED, weighted } from "./seed.ts";

/*
 * The mock data set (plan frontend-portal-admin-plan.md §2). Built from the
 * fixed seed and anchored to "today" in Central Time, so the demo always
 * looks current and the same day gives the same data. Session states
 * (upcoming / in progress / ended) follow the clock passed in.
 *
 * Coverage (unit-tested in mock.test.ts): the four accounts; sibling
 * families; every level of help with fees, with and without a fund; three
 * fully funded families; every billing status; failed payments and earlier
 * months owed; archived and left students; the Weekend program in two
 * groups; last summer's camp; all six attendance statuses; a teacher who is
 * still being set up (no Zoom account, no students).
 */

export const ANCHOR_ZONE = "America/Chicago";

export type Dataset = {
  /** Today in Central Time, YYYY-MM-DD. */
  anchor: string;
  thresholds: Thresholds;
  accounts: Account[];
  teachers: Teacher[];
  families: Family[];
  students: Student[];
  billing: BillingAccount[];
  registrations: Registration[];
  sessions: ClassSession[];
};

export const THRESHOLDS: Thresholds = { presentPercent: 70, partialPercent: 30, noShowAlertMinutes: 10 };

/* ── Dates ─────────────────────────────────────────────────────────────── */

export function ymdIn(zone: string, at: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
function weekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Noon UTC on that date: the same calendar day in every North American zone (src/lib/time-zone.ts instantAt). */
const noon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

/** The first day of the month after `ymd`. */
function nextFirst(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** K1: a new student's first charge is the first 1st on or after signup + 30 days. */
function firstChargeAfterFreeMonth(signup: string): string {
  const end = addDays(signup, 30);
  return end.endsWith("-01") ? end : nextFirst(end);
}

/** "2026-11" for the month `back` months before the anchor's month. */
function monthBefore(anchor: string, back: number): string {
  const [y, m] = anchor.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 7);
}

/* ── Class plans ───────────────────────────────────────────────────────── */

type Plan = { studentId: string; teacherId: string; courseId: CourseId | null; days: number[]; slot: string; minutes: number };

/** Days of the week for n classes a week (0 = Sunday). */
function daysFor(n: number, random: () => number): number[] {
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6];
  if (n === 5) return [1, 2, 3, 4, 5];
  if (n === 4) return [1, 2, 3, 4];
  if (n === 3) return pick(random, [[1, 3, 5], [2, 4, 6]]);
  if (n === 2) return pick(random, [[2, 4], [6, 0], [1, 3]]);
  return [pick(random, [1, 2, 3, 4, 5, 6])];
}

/** Each teacher's free start times (Central Time), handed out in order so no teacher has two classes at once. */
const SLOTS = ["16:15", "17:00", "17:45", "18:30", "19:15", "20:00", "15:30", "20:45", "07:00", "07:45", "08:30", "21:30"];

/* ── People ────────────────────────────────────────────────────────────── */

type KidSeed = { first: string; gender: "male" | "female"; age: number };

function courseForAge(age: number, adult: boolean, random: () => number): CourseId {
  if (adult) return pick(random, ["tarjumatul-quran", "islamic-studies", "quran-nazirah", "quranic-arabic-level-1"] as const);
  if (age <= 7) return "noorani-qaidah";
  if (age <= 10) return pick(random, ["noorani-qaidah", "quran-nazirah"] as const);
  return pick(random, ["quran-nazirah", "quran-hifz", "islamic-studies", "quranic-arabic-level-1"] as const);
}

function daysForCourse(course: CourseId, random: () => number): number {
  const c = courseById(course);
  if (c.minDays === c.maxDays) return c.minDays;
  if (course === "quran-hifz") return pick(random, [3, 4, 5]);
  return pick(random, [2, 3, 4, 5]);
}

function minutesFor(course: CourseId | null, adult: boolean, random: () => number): Student["minutes"] {
  if (adult) return 60;
  if (course === "quran-hifz") return pick(random, [40, 50] as const);
  return pick(random, [30, 40] as const);
}

/** The settled teacher rule: brothers with male teachers; sisters, and boys up to 10, may learn with a female teacher. */
function teacherFits(t: Teacher, s: { gender: "male" | "female"; age: number }): boolean {
  if (s.gender === "female") return t.gender === "female";
  return t.gender === "male" || s.age <= 10;
}

/* ── The build ─────────────────────────────────────────────────────────── */

export function buildDataset(now: Date): Dataset {
  const anchor = ymdIn(ANCHOR_ZONE, now);
  const random = rng(SEED);
  const families: Family[] = [];
  const students: Student[] = [];
  const plans: Plan[] = [];
  const help = new Map<string, { level: HelpLevel; fund: Fund | null }>();
  const familyStatus = new Map<string, BillingStatus>();
  const signupOf = new Map<string, string>();
  const slotCursor = new Map<string, number>();
  const teacherLoad = new Map<string, number>();

  const nextSlot = (teacherId: string) => {
    const i = slotCursor.get(teacherId) ?? 0;
    slotCursor.set(teacherId, i + 1);
    return SLOTS[i % SLOTS.length];
  };

  const addPlan = (s: Student, slot?: string) => {
    if (!s.teacherId || s.status === "archived") return;
    plans.push({
      studentId: s.id,
      teacherId: s.teacherId,
      courseId: s.courseId,
      days: daysFor(s.daysPerWeek, rng(hash(s.id))),
      slot: slot ?? nextSlot(s.teacherId),
      minutes: s.minutes,
    });
    teacherLoad.set(s.teacherId, (teacherLoad.get(s.teacherId) ?? 0) + 1);
  };

  /* The parent account's family: Amina Siddiqui, Houston, with Yusuf and Maryam. */
  families.push({
    id: "f-siddiqui",
    guardianName: "Amina Siddiqui",
    email: "amina.siddiqui@example.com",
    city: "Houston",
    region: "TX",
    country: "US",
    zone: "America/Chicago",
    studentIds: ["s-yusuf", "s-maryam"],
  });
  const yusuf: Student = {
    id: "s-yusuf", firstName: "Yusuf", lastName: "Siddiqui", age: 12, adult: false, familyId: "f-siddiqui", program: "monthly",
    courseId: "quran-hifz", daysPerWeek: 5, minutes: 40, teacherId: "t-imran", zone: "America/Chicago", status: "active", group: null,
  };
  const maryam: Student = {
    id: "s-maryam", firstName: "Maryam", lastName: "Siddiqui", age: 8, adult: false, familyId: "f-siddiqui", program: "monthly",
    courseId: "noorani-qaidah", daysPerWeek: 3, minutes: 30, teacherId: "t-rumana", zone: "America/Chicago", status: "active", group: null,
  };
  students.push(yusuf, maryam);
  addPlan(yusuf, nextSlot("t-imran"));
  // Siblings are not taught at the same moment: Maryam takes her teacher's second slot.
  nextSlot("t-rumana");
  addPlan(maryam, nextSlot("t-rumana"));
  help.set("s-yusuf", { level: 30, fund: "zakat" });
  help.set("s-maryam", { level: "full", fund: "zakat" }); // owner answer 14: Maryam is fully funded
  familyStatus.set("f-siddiqui", "active");
  signupOf.set("f-siddiqui", addDays(anchor, -160));

  /* The student account: Farhana Karim, an adult learner in Toronto, her own family and billing. */
  families.push({
    id: "f-karim",
    guardianName: "Farhana Karim",
    email: "farhana.karim@example.com",
    city: "Toronto",
    region: "ON",
    country: "CA",
    zone: "America/Toronto",
    studentIds: ["s-farhana"],
  });
  const farhana: Student = {
    id: "s-farhana", firstName: "Farhana", lastName: "Karim", age: 31, adult: true, familyId: "f-karim", program: "monthly",
    courseId: "tarjumatul-quran", daysPerWeek: 2, minutes: 60, teacherId: "t-sumaiya", zone: "America/Toronto", status: "active", group: null,
  };
  students.push(farhana);
  addPlan(farhana, nextSlot("t-sumaiya"));
  familyStatus.set("f-karim", "active");
  signupOf.set("f-karim", addDays(anchor, -95));

  /* 44 more families. */
  const helpPlan: Record<number, { level: HelpLevel; fund: Fund | null; whole?: boolean }> = {
    0: { level: 30, fund: "zakat" },
    1: { level: 45, fund: "special" },
    2: { level: 50, fund: "zakat" },
    3: { level: "full", fund: "zakat", whole: true },
    4: { level: "full", fund: "zakat", whole: true },
    5: { level: "full", fund: "special", whole: true },
    6: { level: 30, fund: null }, // a reduced fee with no fund: the ledger warns
    9: { level: 45, fund: null },
  };
  const statusPlan: Record<number, BillingStatus> = {
    10: "not_sent", 11: "link_sent", 12: "free_month", 13: "waiting_first_charge", 14: "past_due", 15: "unpaid",
    16: "paused", 17: "review", 18: "bank_verification", 19: "link_sent", 20: "canceled", 21: "canceled", 22: "canceled", 23: "ending",
  };
  const weekendFamilies = new Set([24, 25, 26, 27, 28, 29, 30, 31]);
  let imranExtra = 0;

  for (let i = 0; i < 44; i++) {
    const r = rng(hash(`family-${i}`));
    const place = PLACES[i % PLACES.length];
    const surname = SURNAMES[i % SURNAMES.length];
    const adultLearner = i >= 40;
    const kidCount = adultLearner ? 0 : i < 7 ? 2 : i === 7 ? 3 : 1;
    const guardianFirst = i % 2 === 0 ? ADULT_WOMEN[i % ADULT_WOMEN.length] : ADULT_MEN[i % ADULT_MEN.length];
    const familyId = `f-${String(i + 1).padStart(2, "0")}`;
    const family: Family = {
      id: familyId,
      guardianName: `${guardianFirst} ${surname}`,
      email: `${guardianFirst}.${surname}${i + 1}`.toLowerCase() + "@example.com",
      city: place.city,
      region: place.region,
      country: place.country,
      zone: place.zone,
      studentIds: [],
    };
    families.push(family);
    signupOf.set(familyId, addDays(anchor, -int(r, 20, 300)));
    familyStatus.set(familyId, statusPlan[i] ?? "active");

    const seeds: KidSeed[] = [];
    if (adultLearner) {
      seeds.push({ first: guardianFirst, gender: i % 2 === 0 ? "female" : "male", age: int(r, 22, 58) });
    } else {
      for (let k = 0; k < kidCount; k++) {
        const gender = r() < 0.5 ? "male" : "female";
        seeds.push({ first: gender === "male" ? pick(r, BOYS) : pick(r, GIRLS), gender, age: int(r, 5, 15) });
      }
    }

    seeds.forEach((kid, k) => {
      const id = `s-${String(i + 1).padStart(2, "0")}${String.fromCharCode(97 + k)}`;
      const adult = kid.age >= 18;
      const weekend = weekendFamilies.has(i) && !adult;
      let courseId: CourseId | null = weekend ? null : courseForAge(kid.age, adult, r);
      let teacherId: string | null = null;
      // Seven more boys for the teacher account, so Hafez Imran Chowdhury teaches eight monthly students.
      if (!weekend && kid.gender === "male" && kid.age >= 8 && !adult && imranExtra < 7) {
        courseId = imranExtra % 2 === 0 ? "quran-hifz" : "quran-nazirah";
        teacherId = "t-imran";
        imranExtra++;
      }
      const status: Student["status"] = i >= 20 && i <= 22 ? "archived" : i === 23 ? "left" : "active";
      const s: Student = {
        id,
        firstName: kid.first,
        lastName: surname,
        age: weekend ? Math.min(kid.age, 12) : kid.age,
        adult,
        familyId,
        program: weekend ? "weekend" : "monthly",
        courseId,
        daysPerWeek: weekend ? 2 : courseId ? daysForCourse(courseId, r) : 2,
        minutes: weekend ? 60 : minutesFor(courseId, adult, r),
        teacherId,
        zone: place.zone,
        status,
        group: null,
      };
      if (!weekend && !s.teacherId && courseId) {
        const fits = TEACHERS.filter(
          (t) => t.status === "active" && t.id !== "t-imran" && t.courses.includes(courseId as CourseId) && teacherFits(t, { gender: kid.gender, age: kid.age }),
        );
        // The least-loaded fitting teacher; a seeded tie-break.
        fits.sort((a, b) => (teacherLoad.get(a.id) ?? 0) - (teacherLoad.get(b.id) ?? 0) || hash(a.id + id) - hash(b.id + id));
        s.teacherId = fits[0]?.id ?? null;
      }
      family.studentIds.push(id);
      students.push(s);
      if (!weekend) addPlan(s);
      const h = helpPlan[i];
      if (h && (h.whole || k === 0) && !weekend) help.set(id, { level: h.level, fund: h.fund });
    });
  }

  /* The Weekend Ilm Program: two groups, Saturday and Sunday 10–11 AM CT. */
  const weekendKids = students.filter((s) => s.program === "weekend");
  weekendKids.forEach((s, n) => {
    s.group = n < 4 ? "Weekend group A" : "Weekend group B";
    s.teacherId = n < 4 ? "t-imran" : "t-nadia";
    plans.push({ studentId: s.id, teacherId: s.teacherId, courseId: null, days: [6, 0], slot: "10:00", minutes: 60 });
  });

  const sessions = buildSessions(plans, anchor, now);
  forceStories(sessions, anchor, now);
  const billing = buildBilling(families, students, help, familyStatus, signupOf, anchor);
  const registrations = buildRegistrations(students, anchor, random);

  return { anchor, thresholds: THRESHOLDS, accounts: ACCOUNTS, teachers: TEACHERS, families, students, billing, registrations, sessions };
}

/* ── Sessions ──────────────────────────────────────────────────────────── */

const STATUS_WEIGHTS: (readonly [AttendanceStatus, number])[] = [
  ["present", 82],
  ["partial", 6],
  ["technical-issue", 4],
  ["student-absent", 5],
  ["teacher-no-show", 1.5],
  ["class-not-held", 1.5],
];

/** Zoom facts that give exactly this status with the default thresholds. */
function factsFor(status: AttendanceStatus, minutes: number, r: () => number) {
  switch (status) {
    case "present":
      return { teacherJoined: true, studentJoined: true, overlapMinutes: minutes - int(r, 0, Math.min(4, Math.floor(minutes * 0.2))) };
    case "partial":
      return { teacherJoined: true, studentJoined: true, overlapMinutes: Math.round(minutes * (0.35 + r() * 0.3)) };
    case "technical-issue":
      return { teacherJoined: true, studentJoined: true, overlapMinutes: Math.max(1, Math.round(minutes * (0.05 + r() * 0.2))) };
    case "student-absent":
      return { teacherJoined: true, studentJoined: false, overlapMinutes: 0 };
    case "teacher-no-show":
      return { teacherJoined: false, studentJoined: true, overlapMinutes: 0 };
    default:
      return { teacherJoined: false, studentJoined: false, overlapMinutes: 0 };
  }
}

function sessionAt(plan: Plan, ymd: string, slot: string, minutes: number, kind: ClassSession["kind"], now: Date, forced?: AttendanceStatus): ClassSession {
  const id = `${plan.studentId}-${ymd}${kind === "makeup" ? "-m" : ""}`;
  const start = instantAt(ANCHOR_ZONE, slot, noon(ymd));
  const end = new Date(start.getTime() + minutes * 60_000);
  const state = now < start ? "upcoming" : now < end ? "in_progress" : "ended";
  let status: AttendanceStatus | null = null;
  let overlapMinutes: number | null = null;
  if (state === "ended") {
    const r = rng(hash(id));
    const wanted = forced ?? weighted(r, STATUS_WEIGHTS);
    const facts = factsFor(wanted, minutes, r);
    status = statusFromOverlap({ ...facts, scheduledMinutes: minutes }, THRESHOLDS);
    overlapMinutes = status === "class-not-held" ? null : facts.overlapMinutes;
  }
  return { id, studentId: plan.studentId, teacherId: plan.teacherId, courseId: plan.courseId, startsAt: start.toISOString(), minutes, kind, state, status, overlapMinutes };
}

function buildSessions(plans: Plan[], anchor: string, now: Date): ClassSession[] {
  const out: ClassSession[] = [];
  for (let offset = -35; offset <= 14; offset++) {
    const ymd = addDays(anchor, offset);
    const day = weekday(ymd);
    for (const plan of plans) if (plan.days.includes(day)) out.push(sessionAt(plan, ymd, plan.slot, plan.minutes, "regular", now));
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/**
 * The stories the demo tells, whatever the seed draws: Yusuf's teacher did
 * not come to one class last week and a make-up followed (the parent's
 * "needs your attention"), and every one of the six statuses appears.
 */
function forceStories(sessions: ClassSession[], anchor: string, now: Date) {
  const yusufPast = sessions.filter((s) => s.studentId === "s-yusuf" && s.state === "ended" && s.startsAt < new Date(`${addDays(anchor, -4)}T00:00:00Z`).toISOString());
  const noShow = yusufPast.at(-1);
  if (noShow) {
    const plan: Plan = { studentId: "s-yusuf", teacherId: "t-imran", courseId: "quran-hifz", days: [], slot: "11:00", minutes: noShow.minutes };
    noShow.status = "teacher-no-show";
    noShow.overlapMinutes = 0;
    // The make-up: the Saturday after, 11 AM CT.
    let ymd = noShow.startsAt.slice(0, 10);
    do ymd = addDays(ymd, 1);
    while (weekday(ymd) !== 6);
    sessions.push(sessionAt(plan, ymd, "11:00", plan.minutes, "makeup", now));
  }
  const protectedIds = new Set(["s-yusuf", "s-maryam", "s-farhana"]);
  const ended = sessions.filter((s) => s.state === "ended" && !protectedIds.has(s.studentId));
  for (const status of ["partial", "technical-issue", "student-absent", "teacher-no-show", "class-not-held"] as const) {
    if (sessions.some((s) => s.status === status)) continue;
    const target = ended.find((s) => s.status === "present");
    if (!target) continue;
    target.status = status;
    target.overlapMinutes = status === "class-not-held" ? null : status === "partial" ? Math.round(target.minutes * 0.5) : status === "technical-issue" ? 3 : 0;
  }
  sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/* ── Billing ───────────────────────────────────────────────────────────── */

const METHODS: BillingAccount["method"][] = [
  { kind: "card", brand: "Visa", last4: "4242" },
  { kind: "card", brand: "Mastercard", last4: "4444" },
  { kind: "bank", brand: "US bank account", last4: "6789" },
];

function buildBilling(
  families: Family[],
  students: Student[],
  help: Map<string, { level: HelpLevel; fund: Fund | null }>,
  statusOf: Map<string, BillingStatus>,
  signupOf: Map<string, string>,
  anchor: string,
): BillingAccount[] {
  const out: BillingAccount[] = [];
  for (const family of families) {
    const members = students.filter((s) => s.familyId === family.id && s.program === "monthly" && s.courseId && s.status !== "archived");
    const archivedOnly = students.some((s) => s.familyId === family.id && s.status === "archived");
    if (!members.length && !archivedOnly) continue; // Weekend-only families: the program is free, so no billing account
    const lines: BillingLine[] = members.map((s) => {
      const fullCents = monthlyFee(courseById(s.courseId as CourseId), s.daysPerWeek) * 100;
      const h = help.get(s.id) ?? null;
      const monthlyCents = !h ? fullCents : h.level === "full" ? 0 : Math.round((fullCents * (100 - h.level)) / 100);
      return { studentId: s.id, courseId: s.courseId as CourseId, daysPerWeek: s.daysPerWeek, fullCents, help: h, monthlyCents };
    });
    const monthlyCents = lines.reduce((sum, l) => sum + l.monthlyCents, 0);
    const status = statusOf.get(family.id) ?? "active";
    const r = rng(hash(`billing-${family.id}`));
    const signup = signupOf.get(family.id) ?? anchor;
    const funded = monthlyCents === 0;
    const hasCard = !["not_sent", "link_sent"].includes(status) && !funded;
    const method = hasCard ? (family.id === "f-siddiqui" ? METHODS[0] : family.id === "f-karim" ? METHODS[1] : pick(r, METHODS)) : null;

    const payments: Payment[] = [];
    const owedMonths: BillingAccount["owedMonths"] = [];
    const billedStatuses: BillingStatus[] = ["active", "past_due", "unpaid", "paused", "ending", "canceled", "review"];
    if (!funded && billedStatuses.includes(status)) {
      // Months since the first charge (the free month first), at most 12.
      const firstCharge = firstChargeAfterFreeMonth(signup);
      for (let back = 0; back < 12; back++) {
        const month = monthBefore(anchor, back);
        if (`${month}-01` < firstCharge || `${month}-01` > anchor) continue;
        const on = `${month}-01`;
        let p: Payment = { id: `pay-${family.id}-${month}`, month, amountCents: monthlyCents, status: "paid", on, attempts: 1, failureReason: null };
        if (back === 0 && status === "past_due") p = { ...p, status: "failed", attempts: 2, on: addDays(on, 3), failureReason: "The card was declined." };
        if (back <= 1 && status === "unpaid") {
          p = { ...p, status: "failed", attempts: 4, failureReason: "The card was declined." };
          owedMonths.push({ month, amountCents: monthlyCents });
        }
        payments.push(p);
      }
    }

    const chargesNext: BillingStatus[] = ["active", "past_due", "review"];
    let nextChargeOn: string | null = null;
    if (!funded && chargesNext.includes(status)) nextChargeOn = nextFirst(anchor);
    if (!funded && (status === "free_month" || status === "waiting_first_charge")) nextChargeOn = firstChargeAfterFreeMonth(addDays(anchor, -int(r, 3, 25)));

    out.push({ id: `b-${family.id}`, familyId: family.id, status: archivedOnly && !members.length ? "canceled" : status, lines, monthlyCents, nextChargeOn, method, payments, owedMonths });
  }
  // One refund (a class not held), on the first other active family with a few paid months.
  const refunded = out.find((b) => b.status === "active" && !["f-siddiqui", "f-karim"].includes(b.familyId) && b.payments.length >= 3);
  if (refunded) refunded.payments[2] = { ...refunded.payments[2], status: "refunded" };
  return out;
}

/* ── Registrations ─────────────────────────────────────────────────────── */

function buildRegistrations(students: Student[], anchor: string, random: () => number): Registration[] {
  const out: Registration[] = [];
  let n = 9001;
  const at = (daysAgo: number, hour: number) => `${addDays(anchor, -daysAgo)}T${String(hour).padStart(2, "0")}:15:00.000Z`;
  for (const s of students) {
    const ref = `IQU-${n++}`;
    const weekend = s.program === "weekend";
    const status: RegistrationStatus = s.status === "archived" ? "cancelled" : weekend ? "confirmed" : "enrolled";
    out.push({
      reference: ref,
      studentId: s.id,
      studentName: `${s.firstName} ${s.lastName}`,
      program: weekend ? "weekend_new" : "monthly",
      courseId: s.courseId,
      status,
      createdVia: n % 11 === 5 ? "import" : n % 7 === 3 ? "admin" : "public",
      createdAt: at(30 + (hash(s.id) % 240), 14 + (hash(s.id) % 8)),
      openReviewReasons: [],
      archived: s.status === "archived",
    });
  }
  // New applicants, not students yet: every status the admin works through.
  const newcomers: [RegistrationStatus, string[]][] = [
    ["pending", []],
    ["card_pending", []],
    ["card_pending", []],
    ["pending_review", ["help"]],
    ["pending_review", ["sibling"]],
    ["pending_review", ["location"]],
    ["pending_review", ["existing_student"]],
    ["contacted", []],
    ["confirmed", []],
    ["expired", []],
    ["cancelled", []],
    ["pending", []],
  ];
  newcomers.forEach(([status, reasons], k) => {
    const girl = random() < 0.5;
    out.push({
      reference: `IQU-${n++}`,
      studentId: null,
      studentName: `${girl ? pick(random, GIRLS) : pick(random, BOYS)} ${pick(random, SURNAMES)}`,
      program: "monthly",
      courseId: pick(random, ["noorani-qaidah", "quran-nazirah", "quran-hifz", "islamic-studies"] as const),
      status,
      createdVia: "public",
      createdAt: at(k % 9, 13 + (k % 9)),
      openReviewReasons: reasons,
      archived: false,
    });
  });
  // Last summer's camp (2026): Level 1 and Level 2, paid, confirmed or cancelled.
  const summer: [Registration["program"], RegistrationStatus][] = [
    ["summer_l1", "paid"], ["summer_l1", "paid"], ["summer_l1", "confirmed"], ["summer_l1", "cancelled"],
    ["summer_l2", "paid"], ["summer_l2", "paid"], ["summer_l2", "paid"], ["summer_l2", "confirmed"],
  ];
  summer.forEach(([program, status], k) => {
    const girl = random() < 0.5;
    out.push({
      reference: `IQU-${n++}`,
      studentId: null,
      studentName: `${girl ? pick(random, GIRLS) : pick(random, BOYS)} ${pick(random, SURNAMES)}`,
      program,
      courseId: null,
      status,
      createdVia: "public",
      createdAt: `2026-0${5 + (k % 2)}-${String(10 + k).padStart(2, "0")}T16:00:00.000Z`,
      openReviewReasons: [],
      archived: false,
    });
  });
  return out;
}
