import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { emptyDraft, type Draft } from "../../lib/enroll/schema.ts";
import { BILLING_STATUSES } from "../contracts/billing.ts";
import { REGISTRATION_STATUSES } from "../contracts/registrations.ts";
import { ATTENDANCE_STATUSES, statusFromOverlap } from "../contracts/schedule.ts";
import { buildDataset, THRESHOLDS } from "./build.ts";
import { mockEnrollment } from "./enrollment.ts";
import { createMockSource } from "./index.ts";

/*
 * The mock data set (portal Batch 1; plan frontend-portal-admin-plan.md §2).
 * The clock is pinned: a Friday evening in Central Time, 27 Nov 2026.
 */

const NOW = new Date("2026-11-28T00:30:00Z"); // Fri 27 Nov 2026, 6:30 PM CT
const data = buildDataset(NOW);

test("the data set is deterministic: the same moment gives the same data", () => {
  assert.equal(JSON.stringify(buildDataset(NOW)), JSON.stringify(data));
  assert.equal(data.anchor, "2026-11-27");
});

test("the four accounts, exactly as planned, with no password anywhere", () => {
  const byEmail = new Map(data.accounts.map((a) => [a.email, a]));
  assert.deepEqual([...byEmail.keys()].sort(), ["admin@ilmulquranus.org", "parent@ilmulquranus.org", "student@ilmulquranus.org", "teacher@ilmulquranus.org"]);
  assert.deepEqual(byEmail.get("admin@ilmulquranus.org")!.roles, ["admin", "billing_admin"]);
  assert.deepEqual(byEmail.get("teacher@ilmulquranus.org")!.roles, ["teacher"]);
  assert.equal(byEmail.get("teacher@ilmulquranus.org")!.name, "Hafez Imran Chowdhury");
  assert.deepEqual(byEmail.get("parent@ilmulquranus.org")!.roles, ["parent"]);
  assert.deepEqual(byEmail.get("student@ilmulquranus.org")!.roles, ["student"]);
  assert.doesNotMatch(JSON.stringify(data), /password/i);
});

test("parent@: Amina with Yusuf (Hifz, 30% help, Zakat) and Maryam (Qaidah, full Zakat scholarship) under one family billing", () => {
  const family = data.families.find((f) => f.id === "f-siddiqui")!;
  assert.equal(family.guardianName, "Amina Siddiqui");
  const kids = data.students.filter((s) => s.familyId === family.id);
  assert.deepEqual(kids.map((k) => k.firstName), ["Yusuf", "Maryam"]);
  assert.equal(kids[0].courseId, "quran-hifz");
  assert.equal(kids[0].teacherId, "t-imran");
  assert.equal(kids[1].courseId, "noorani-qaidah");
  const billing = data.billing.find((b) => b.familyId === family.id)!;
  const yusuf = billing.lines.find((l) => l.studentId === "s-yusuf")!;
  const maryam = billing.lines.find((l) => l.studentId === "s-maryam")!;
  assert.deepEqual(yusuf.help, { level: 30, fund: "zakat" });
  assert.equal(yusuf.monthlyCents, Math.round(yusuf.fullCents * 0.7));
  assert.deepEqual(maryam.help, { level: "full", fund: "zakat" });
  assert.equal(maryam.monthlyCents, 0);
  assert.equal(billing.monthlyCents, yusuf.monthlyCents);
  assert.equal(billing.method?.last4, "4242");
  assert.equal(billing.nextChargeOn, "2026-12-01", "K1: the 1st");
});

test("student@: Farhana, an adult learner, unrelated to the parent account, with her own family billing", () => {
  const farhana = data.students.find((s) => s.id === "s-farhana")!;
  assert.equal(farhana.adult, true);
  assert.equal(farhana.familyId, "f-karim");
  assert.notEqual(farhana.familyId, "f-siddiqui");
  assert.equal(farhana.zone, "America/Toronto");
  const billing = data.billing.find((b) => b.familyId === "f-karim")!;
  assert.equal(billing.lines.length, 1);
  assert.equal(billing.status, "active");
  assert.ok(billing.payments.every((p) => p.status === "paid"));
});

test("teacher@ teaches eight monthly students (Yusuf among them) and a Weekend group, and nobody else's", () => {
  const monthly = data.students.filter((s) => s.teacherId === "t-imran" && s.program === "monthly");
  assert.equal(monthly.length, 8);
  assert.ok(monthly.some((s) => s.id === "s-yusuf"));
  assert.ok(data.students.some((s) => s.teacherId === "t-imran" && s.group === "Weekend group A"));
  assert.ok(!data.students.some((s) => s.id === "s-farhana" && s.teacherId === "t-imran"));
});

test("no mock teacher is a real IQU teacher, and family emails can never receive mail", () => {
  const strip = (n: string) => n.replace(/^(Hafez|Hafezah|Mawlana|Mufti)\s+/, "").toLowerCase();
  // The real teachers, read from src/content/instructors.ts as text (its extensionless imports do not load under plain Node).
  const source = readFileSync(new URL("../../content/instructors.ts", import.meta.url), "utf8");
  const real = new Set([...source.matchAll(/^\s+name: "([^"]+)"/gm)].map((m) => strip(m[1])));
  assert.ok(real.size >= 20);
  for (const t of data.teachers) assert.ok(!real.has(strip(t.name)), t.name);
  for (const f of data.families) assert.match(f.email, /@example\.com$/);
});

test("coverage: every billing and registration status, all six attendance statuses", () => {
  for (const s of BILLING_STATUSES) assert.ok(data.billing.some((b) => b.status === s), `billing ${s}`);
  for (const s of REGISTRATION_STATUSES) assert.ok(data.registrations.some((r) => r.status === s), `registration ${s}`);
  for (const s of ATTENDANCE_STATUSES) assert.ok(data.sessions.some((x) => x.status === s), `attendance ${s}`);
});

test("coverage: sibling families, every level of help, funds missing, full scholarships, failed payments and arrears", () => {
  const siblings = data.families.filter((f) => data.students.filter((s) => s.familyId === f.id).length >= 2);
  assert.ok(siblings.length >= 9, `sibling families: ${siblings.length}`);
  const lines = data.billing.flatMap((b) => b.lines);
  for (const level of [30, 45, 50, "full"] as const) assert.ok(lines.some((l) => l.help?.level === level), `help ${level}`);
  assert.ok(lines.filter((l) => l.help && l.help.fund === null).length >= 2, "reduced fees with no fund");
  const fullyFunded = data.billing.filter((b) => b.lines.length > 0 && b.lines.every((l) => l.help?.level === "full"));
  assert.ok(fullyFunded.length >= 3, "fully funded families");
  for (const b of fullyFunded) assert.equal(b.payments.length, 0, "a scholarship family never has a $0 invoice");
  assert.ok(data.billing.some((b) => b.payments.some((p) => p.status === "failed")), "a failed payment");
  assert.ok(data.billing.some((b) => b.owedMonths.length >= 2), "earlier months owed");
  assert.ok(data.billing.some((b) => b.payments.some((p) => p.status === "refunded")), "a refund");
});

test("coverage: archived and left students, Weekend in two groups, last summer's camp, a teacher still being set up", () => {
  assert.equal(data.students.filter((s) => s.status === "archived").length >= 3, true);
  assert.equal(data.students.filter((s) => s.status === "left").length >= 1, true);
  const weekend = data.students.filter((s) => s.program === "weekend");
  assert.equal(weekend.length, 8);
  assert.deepEqual([...new Set(weekend.map((s) => s.group))].sort(), ["Weekend group A", "Weekend group B"]);
  assert.ok(data.registrations.some((r) => r.program === "summer_l1") && data.registrations.some((r) => r.program === "summer_l2"));
  const setup = data.teachers.find((t) => t.status === "setup")!;
  assert.equal(setup.zoomLinked, false);
  assert.equal(data.students.filter((s) => s.teacherId === setup.id).length, 0);
  // Every North American zone label families use.
  const zones = new Set(data.families.map((f) => f.zone));
  for (const z of ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Halifax", "America/Anchorage"]) assert.ok(zones.has(z), z);
});

test("Yusuf's teacher did not come to one class last week, and a make-up followed", () => {
  const yusuf = data.sessions.filter((s) => s.studentId === "s-yusuf");
  assert.ok(yusuf.some((s) => s.status === "teacher-no-show"));
  assert.ok(yusuf.some((s) => s.kind === "makeup"));
});

test("statuses are measured facts: each one matches its overlap under the thresholds, and future classes have none", () => {
  for (const s of data.sessions) {
    if (s.state !== "ended") {
      assert.equal(s.status, null);
      continue;
    }
    if (s.status === "class-not-held") assert.equal(s.overlapMinutes, null);
    else if (s.status === "teacher-no-show" || s.status === "student-absent") assert.equal(s.overlapMinutes, 0);
    else {
      const got = statusFromOverlap({ teacherJoined: true, studentJoined: true, overlapMinutes: s.overlapMinutes!, scheduledMinutes: s.minutes }, THRESHOLDS);
      assert.equal(got, s.status, s.id);
    }
  }
  assert.ok(data.sessions.some((s) => s.state === "upcoming"));
  // A teacher never has two classes at the same moment (group classes aside).
  const seen = new Set<string>();
  for (const s of data.sessions.filter((x) => x.courseId)) {
    const key = `${s.teacherId}@${s.startsAt}`;
    assert.ok(!seen.has(key), key);
    seen.add(key);
  }
});

test("the mock source answers the repositories", async () => {
  const source = createMockSource(() => NOW);
  assert.equal(source.mode, "mock");
  assert.equal((await source.people.accountByEmail(" Parent@ilmulquranus.org "))?.id, "acc-parent");
  assert.equal((await source.people.studentsOfFamily("f-siddiqui")).length, 2);
  const day = await source.schedule.forTeacher("t-imran", new Date("2026-11-27T00:00:00Z"), new Date("2026-11-29T00:00:00Z"));
  assert.ok(day.length > 0);
  assert.equal((await source.billing.forFamily("f-siddiqui"))?.familyId, "f-siddiqui");
});

/* ── The /enroll mock (dev preview) ─────────────────────────────────── */

function complete(): Draft {
  return {
    ...emptyDraft("monthly", "0123456789abcdef0123"),
    who: "child",
    firstName: "Zayd",
    lastName: "Example",
    dob: "2017-03-09",
    guardianName: "Sample Guardian",
    email: "parent@example.com",
    phoneCountry: "US",
    phone: "(214) 555-0123",
    residence: "US",
    origin: "US",
    languages: ["english"],
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

test("the mock enrollment validates like the live path and ends on our own confirmation (card step: being set up)", async () => {
  const ok = await mockEnrollment.submit(complete(), NOW);
  assert.equal(ok.status, "ok");
  if (ok.status === "ok") {
    assert.match(ok.href, /^\/enroll\/confirmation\?s=card-next&ref=IQU-9[5-8]\d\d$/);
    assert.doesNotMatch(ok.href, /ilmulquranus\.org|eid=/);
  }
  const help = await mockEnrollment.submit({ ...complete(), feeChoice: "help", helpLevel: "50" }, NOW);
  assert.equal(help.status, "ok");
  if (help.status === "ok") assert.match(help.href, /s=aid/);
  const bad = await mockEnrollment.submit({ ...complete(), email: "not-an-email" }, NOW);
  assert.equal(bad.status, "invalid");
  assert.equal((await mockEnrollment.submit({ nonsense: true }, NOW)).status, "error");
});
