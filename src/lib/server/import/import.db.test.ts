import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import { freeMonthEligible } from "../cron/ledger.ts";
import { e164 } from "../migrate/values.ts";
import { BOM, csvLine, parseCsv } from "./csv.ts";
import { EXPECTED, PLUGIN_NOW, type PluginRow } from "./fixtures/parity-expected.ts";
import { checkFile, confirm, levelCounts, prepare, resultsCsv, sampleCsv, toInput, type PreviewState } from "./students.ts";

/*
 * P5 bulk import of current students on PGlite. The parity test feeds
 * fixtures/parity.csv (synthetic people) through our checkFile and compares
 * every row with what the LIVE plugin answered for the same file
 * (fixtures/parity-expected.ts): level, every error and warning message,
 * gross / net, and the registration each valid row becomes.
 */

const { registrations } = schema;
let client: PGlite;
let db: AnyDb;

before(async () => {
  client = await PGlite.create();
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  db = drizzle(client, { schema }) as unknown as AnyDb;
});
after(async () => {
  await client.close();
});
beforeEach(async () => {
  const tables = (await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).rows.map((r) => `"${r.tablename}"`);
  await client.exec(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
});

const ctx = (over: Partial<{ now: Date; user: string; dry: boolean }> = {}) => ({ db, now: PLUGIN_NOW, adminLogin: "admin1", user: "user-1", ...over });
const bytes = (s: string) => new TextEncoder().encode(s);
const PARITY = readFileSync(join(import.meta.dirname, "fixtures", "parity.csv"));
const file = (rows: string[][], header = ["First Name", "Last Name", "Email", "WhatsApp", "Course", "Days/Week"]) => bytes(BOM + [header, ...rows].map((r) => csvLine(r)).join(""));
const preview = async (b: Uint8Array, name = "students.csv", over = {}) => {
  const s = await checkFile(b, name, ctx(over));
  assert.ok(!("error" in s), "error" in s ? s.error : "");
  return s as PreviewState;
};

/** Our registration row in the plugin's column names, for the parity comparison. */
function asPlugin(r: typeof registrations.$inferInsert, whatsapp: string): PluginRow {
  const d = (c: number | null | undefined) => (c ?? 0) / 100;
  const out: PluginRow = {
    form_type: r.program === "monthly" ? "free" : String(r.program),
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email,
    whatsapp: e164(whatsapp) === r.whatsappE164 ? whatsapp : `MISMATCH ${r.whatsappE164}`,
    guardian_name: r.guardianName ?? "",
    guardian_whatsapp: r.guardianName ? (r.guardianWhatsappE164 === e164(whatsapp) ? whatsapp : "MISMATCH") : "",
    days_per_week: String(r.daysPerWeek),
    referral: r.referral ?? "",
    course_type: r.courseKey ?? "",
    per_class_rate: d(r.perClassCents),
    calculated_amount: d(r.calculatedCents),
    discount_amount: d(r.discountCents),
    payment_amount: d(r.paymentCents),
    zakat_declaration: r.zakatDeclaration ? 1 : 0,
    special_discount: r.specialPlan ? 1 : 0,
    flexible_fee_note: r.flexibleFeeNote ?? "",
    status: String(r.status),
    created_via: String(r.createdVia),
    existing_student: r.existingStudent ? 1 : 0,
  };
  if (r.agreedFeeCents !== null && r.agreedFeeCents !== undefined) out.agreed_fee = d(r.agreedFeeCents);
  if (r.agreedFeeFund) out.agreed_fee_fund = r.agreedFeeFund;
  if (r.dateOfBirth) out.date_of_birth = r.dateOfBirth;
  if (r.ageAtSignup) out.age = r.ageAtSignup;
  if (r.countryOriginName) out.country_origin = r.countryOriginName;
  if (r.countryResName) out.country_res = r.countryResName;
  if (r.quranLevel) out.quran_level = r.quranLevel;
  if (r.memorized) out.memorized = r.memorized;
  if (r.languages?.length) out.languages = r.languages.join(", ");
  if (r.preferredDays?.length) out.preferred_days = r.preferredDays.join(", ");
  if (r.timeSlotText) out.time_slot = r.timeSlotText;
  if (r.sessionMinutes) out.session_dur = String(r.sessionMinutes);
  if (r.teacherPref) out.teacher_pref = r.teacherPref;
  if (r.referralOther) out.referral_other = r.referralOther;
  return out;
}

/* ── Parity with the live plugin ─────────────────────────────────────── */

test("parity: every row of the same file gives the plugin's level, messages, fees and input", async () => {
  const s = await preview(new Uint8Array(PARITY), "parity.csv");
  assert.deepEqual(s.preview.map((r) => r.line), EXPECTED.map((e) => e.line), "the same rows (the blank line 22 skipped)");
  for (const [i, want] of EXPECTED.entries()) {
    const got = s.preview[i];
    const pick = { first_name: got.in.first_name, email: got.in.email, whatsapp: got.in.whatsapp, course: got.in.course, days: got.in.days, use_agreed: got.in.use_agreed, agreed_fee: got.in.agreed_fee, zakat: got.in.zakat };
    assert.deepEqual(
      { level: got.level, errors: got.errors, warnings: got.warnings, gross: got.gross, net: got.net, courseMissing: got.courseMissing, in: pick },
      { level: want.level, errors: want.errors, warnings: want.warnings, gross: want.gross, net: want.net, courseMissing: want.courseMissing, in: want.in },
      `row ${want.line}`,
    );
  }
  assert.deepEqual(levelCounts(s.preview), { ok: 7, warning: 4, error: 14 });
});

test("parity: each valid row becomes the registration the plugin would insert", async () => {
  const s = await preview(new Uint8Array(PARITY), "parity.csv");
  for (const want of EXPECTED.filter((e) => e.row)) {
    const got = s.preview.find((r) => r.line === want.line)!;
    const prep = await prepare(got.in, ctx());
    assert.ok(prep.row, `row ${want.line}`);
    const mine = asPlugin(prep.row, String(want.row!.whatsapp));
    for (const [k, v] of Object.entries(want.row!)) assert.deepEqual(mine[k], v, `row ${want.line}: ${k}`);
    for (const k of Object.keys(mine)) assert.ok(k in want.row! || ["guardian_whatsapp"].includes(k), `row ${want.line}: ${k} is not a plugin column here`);
  }
});

test("the sample file is the plugin's, byte for byte (tooling/import-students-sample.csv)", () => {
  const plugin = readFileSync(join(process.cwd(), "tooling", "import-students-sample.csv"), "utf8");
  assert.equal(sampleCsv(), plugin);
  // And it imports cleanly: two students, both OK.
  const records = parseCsv(plugin);
  assert.equal(records.length, 3);
});

test("the sample file passes its own checks", async () => {
  const s = await preview(bytes(sampleCsv()), "iqu-import-students-sample.csv");
  assert.deepEqual(s.preview.map((r) => [r.line, r.level, r.net]), [[2, "ok", 64], [3, "ok", 30]]);
});

/* ── Import (confirm) ────────────────────────────────────────────────── */

test("confirm: valid rows are imported as existing students (no free month, Q13); error rows are skipped", async () => {
  const s = await preview(new Uint8Array(PARITY), "parity.csv");
  const res = await confirm(s, s.key, ctx());
  assert.ok("done" in res);
  const { done } = res as { done: Awaited<ReturnType<typeof confirm>> extends infer T ? (T extends { done: infer D } ? D : never) : never };
  // 7 OK + 4 warnings added; billed = a fee above $0 and a course (the $0 scholarship and the two with no course are not).
  assert.deepEqual([done.added, done.warned, done.noCourse, done.billed, done.failed.length, done.skipped.length], [11, 4, 2, 8, 0, 14]);
  const regs = await db.select().from(registrations).orderBy(asc(registrations.id));
  assert.equal(regs.length, 11);
  for (const r of regs) {
    assert.deepEqual([r.program, r.status, r.createdVia, r.existingStudent], ["monthly", "enrolled", "import", true]);
    assert.equal(freeMonthEligible(r), false, "no free month for an imported student");
    assert.match(r.adminNote ?? "", /^Imported from CSV\/Excel by admin1\./);
  }
  const scholar = regs.find((r) => r.firstName === "Testt")!;
  assert.deepEqual([scholar.agreedFeeCents, scholar.agreedFeeFund, scholar.paymentCents, scholar.whatsappE164, scholar.guardianWhatsappE164], [0, "zakat", 0, "+442079460958", "+442079460958"]);
  assert.deepEqual(done.levels[2], "ok");
  assert.deepEqual(done.levels[3], "error");
});

test("one import per checked file; afterwards the same file reports every student as already enrolled", async () => {
  const s = await preview(new Uint8Array(PARITY), "parity.csv");
  const [a, b] = await Promise.all([confirm(s, s.key, ctx()), confirm(s, s.key, ctx())]);
  const errors = [a, b].filter((x) => "error" in x).map((x) => (x as { error: string }).error);
  assert.deepEqual(errors, ["This file is already being imported. Check Student Billing in a moment, and upload it again only if the students are missing."]);
  assert.equal((await db.select().from(registrations)).length, 11);

  const again = await preview(new Uint8Array(PARITY), "parity.csv");
  const testa = again.preview.find((r) => r.line === 2)!;
  assert.deepEqual(testa.errors, ["Already in the enrollment records (same name and email)."]);
});

test("confirm refuses: a wrong key, another user, an expired check, or a change since 'Validate only'", async () => {
  const s = await preview(file([["Zq", "One", "zq@example.com", "+1 214 555 0100", "qaidah", "3"]]));
  assert.deepEqual(await confirm(s, "wrong-key", ctx()), { error: "This preview has expired. Please upload the file again." });
  assert.deepEqual(await confirm(s, s.key, ctx({ user: "user-2" })), { error: "This checked file belongs to another user. Please upload the file again." });
  assert.deepEqual(await confirm(s, s.key, ctx({ now: new Date(PLUGIN_NOW.getTime() + 61 * 60_000) })), { error: "The checked file has expired (it is kept for 1 hour). Please upload it again." });

  const dry = await preview(file([["Zq", "Two", "zq2@example.com", "+1 214 555 0100", "qaidah", "3"]]), "students.csv", { dry: true });
  await db.insert(registrations).values({ program: "monthly", firstName: "Zq", lastName: "Two", email: "zq2@example.com" });
  assert.deepEqual(await confirm(dry, dry.key, ctx()), {
    error: "Something changed since the file was checked (row 2). Nothing was imported. Please upload the file again to check it.",
  });
});

/* ── File checks ─────────────────────────────────────────────────────── */

test("file checks: size, type, empty, missing columns, no students, more than 500", async () => {
  const err = async (b: Uint8Array, name = "s.csv") => ((await checkFile(b, name, ctx())) as { error: string }).error;
  assert.equal(await err(new Uint8Array(0)), "The file must be a CSV or Excel (.xlsx) file under 1 MB.");
  assert.equal(await err(new Uint8Array(1048577)), "The file must be a CSV or Excel (.xlsx) file under 1 MB.");
  assert.equal(await err(bytes("a"), "s.txt"), 'Please upload a .csv or .xlsx file. In Excel or Google Sheets use "Save as / Download as" CSV or Excel (.xlsx).');
  assert.match(await err(bytes("a"), "s.xlsx"), /Excel \(\.xlsx\) files open with the new admin page \(P3\)/);
  assert.equal(await err(bytes("First Name,Email\nA,b@example.com\n")), "These columns are missing: Last Name, Course, Days/Week, WhatsApp. Use the sample file as a guide.");
  assert.equal(await err(bytes("First Name,Last Name,Email,Guardian WhatsApp,Course,Days/Week\n,,,,,\n")), "No students found in the file.");
  const many = file(Array.from({ length: 501 }, (_, i) => [`Zq${i}`, "Many", `m${i}@example.com`, "+1 214 555 0100", "qaidah", "2"]));
  assert.equal(await err(many), "The file has more than 500 students. Split it into smaller files.");
});

test("headers: export names, any case or punctuation, a BOM, and Guardian WhatsApp instead of WhatsApp", async () => {
  const s = await preview(bytes(`${BOM}first_name,LAST NAME,e-mail,Guardian WhatsApp,course,Days per week,Teacher Preference\nZq,Head,zqh@example.com,+1 214 555 0100,Quran Hifz,3,Any\n`));
  // "e-mail" normalises to "email"; "Days per week" to "daysperweek".
  assert.deepEqual([s.preview[0].level, s.preview[0].in.course, s.preview[0].in.whatsapp], ["ok", "hifz", "+1 214 555 0100"]);
});

test("an Age column still works (older files): under 4 is a warning, not an error; a date of birth wins over it (AS:199-207)", async () => {
  const s = await preview(
    file(
      [
        ["Zq", "Small", "zqs@example.com", "+1 214 555 0100", "qaidah", "2", "3", ""],
        ["Zq", "Both", "zqb@example.com", "+1 214 555 0100", "qaidah", "2", "40", "2016-03-04"],
      ],
      ["First Name", "Last Name", "Email", "WhatsApp", "Course", "Days/Week", "Age", "Date of Birth"],
    ),
  );
  assert.deepEqual([s.preview[0].level, s.preview[0].warnings], ["warning", ["Age under 4 — please confirm."]]);
  const both = await prepare(s.preview[1].in, ctx());
  assert.deepEqual([both.row?.ageAtSignup, both.row?.dateOfBirth], [10, "2016-03-04"]);
});

test("cells: formula characters are removed on read and neutralised in the results file", async () => {
  const input = toInput({ first_name: "=HYPERLINK(1)", last_name: "'-Zq", email: " zq@example.com ", whatsapp: "+1 (214) 555-0100 ext", course: "QAD", days: "3 days" });
  assert.deepEqual([input.first_name, input.last_name, input.email, input.whatsapp, input.course, input.days], ["HYPERLINK(1)", "-Zq", "zq@example.com", "+1 (214) 555-0100", "qaidah", 3]);
  const s = await preview(file([["@SUM(1)", "Zq", "zq@example.com", "+1 214 555 0100", "qaidah", "3"]]));
  const out = resultsCsv(s);
  assert.ok(out.startsWith(BOM));
  assert.match(out, /^﻿"First Name","Last Name",Email,WhatsApp,Course,Days\/Week,result,messages\n/);
  assert.match(out, /'@SUM\(1\),Zq,zq@example.com,"'\+1 214 555 0100",qaidah,3,OK,\n$/);
});
