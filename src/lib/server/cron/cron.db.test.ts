import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import { siteMonth, siteMonthStart, siteYmd, zonedMidnight } from "../dhaka.ts";
import { recordBlock } from "../enroll/blocks.ts";
import { parseAllowlist, resetGmailTokenCache, type GmailConfig } from "../outbox/gmail.ts";
import { deliverOutbox, type Adapters } from "../outbox/outbox.ts";
import { telegramConfig } from "../outbox/telegram.ts";
import { fetchDonations, signRequest, utcMonthStart, type Donations } from "./donations.ts";
import { billingDayOnOrAfter, currentItems, firstMonth, freeMonthEnd, isActiveStudent, ledgerItem, runLedger, type Reg } from "./ledger.ts";
import { runCardReminders } from "./reminders.ts";
import { cronAuthorized } from "./auth.ts";
import { buildDailySummary, money2, runDailySummary, type SummaryDeps } from "./summary.ts";

/*
 * P4 jobs end to end on a real Postgres (PGlite, in process), with the same
 * migrations as Neon: the discount ledger (with a parity test against the live
 * plugin's own results), card reminders and expiry, the 9 PM summary and its
 * donations line, the cron secret, and the Dhaka calendar. No network.
 */

const { registrations, families, familyMembers, discountLedger, auditLog, outbox, payments, stripeEvents, coupons, eligibilityBlocks } = schema;

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

/* ── Fixtures ────────────────────────────────────────────────────────── */

const H = 3_600_000;
const D = 24 * H;
const at = (iso: string) => new Date(iso);
const utc = (mysql: string) => new Date(`${mysql.replace(" ", "T")}Z`);

type RegInsert = typeof registrations.$inferInsert;
let regSeq = 0;
async function addReg(over: Partial<RegInsert> = {}): Promise<Reg> {
  const [row] = await db
    .insert(registrations)
    .values({
      program: "monthly",
      status: "enrolled",
      createdVia: "public",
      firstName: "Ayesha",
      lastName: `Student${++regSeq}`,
      email: "parent@example.com",
      courseKey: "qaidah",
      daysPerWeek: 5,
      ...over,
    })
    .returning();
  return row;
}

async function addFamily(over: Partial<typeof families.$inferInsert> = {}) {
  const [row] = await db
    .insert(families)
    .values({ mode: "test", contactEmail: "parent@example.com", studentType: "new", status: "not_sent", ...over })
    .returning();
  return row;
}

async function link(regId: number, familyId: number, firstChargeDate: string | null = null) {
  await db.insert(familyMembers).values({ familyId, registrationId: regId, mode: "test", amountCents: 0, firstChargeDate });
  await db.update(registrations).set({ familyId }).where(eq(registrations.id, regId));
}

async function addCoupon(id: number) {
  await db.insert(coupons).values({ id, code: `ZAKAT-${id}-TEST`, courseKey: "ALL", discountType: "percent", valuePercent: 50 });
}

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const telegramStaging = (): Adapters["telegram"] =>
  telegramConfig(env({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "-100111", NEXT_PUBLIC_SITE_ENV: "staging" }), "^-100999$");

/* ── Dhaka calendar and the cron secret ──────────────────────────────── */

test("Dhaka calendar: 9 PM Dhaka is 15:00 UTC; the month turns at 18:00 UTC the day before", () => {
  assert.equal(siteYmd(at("2026-11-25T15:00:00Z")), "2026-11-25");
  assert.equal(siteYmd(at("2026-11-25T17:59:59Z")), "2026-11-25");
  assert.equal(siteYmd(at("2026-11-25T18:00:00Z")), "2026-11-26");
  assert.equal(siteMonth(at("2026-11-30T17:59:59Z")), "2026-11-01");
  assert.equal(siteMonth(at("2026-11-30T18:00:00Z")), "2026-12-01", "00:00 on 1 Dec in Dhaka is still 30 Nov in UTC");
  assert.equal(siteMonth(at("2026-12-31T18:30:00Z")), "2027-01-01", "the year turns too");
  assert.equal(siteMonthStart(at("2026-11-25T13:45:31Z")).toISOString(), "2026-10-31T18:00:00.000Z", "DB:540-545 month_start_utc, as the plugin printed it");
  assert.equal(zonedMidnight("2027-03-01").toISOString(), "2027-02-28T18:00:00.000Z");
  assert.equal(utcMonthStart(at("2026-11-30T19:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z", "donations keep the plugin's UTC month (N:336)");
});

test("cron secret: Bearer match in constant time; a short or missing secret refuses everyone", () => {
  const secret = "cron-secret-0123456789";
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(cronAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(cronAuthorized(`bearer ${secret}`, secret), false);
  assert.equal(cronAuthorized(null, secret), false);
  assert.equal(cronAuthorized("Bearer short", "short"), false, "under 16 characters is never accepted");
  assert.equal(cronAuthorized("Bearer ", ""), false);
  assert.equal(cronAuthorized("Bearer undefined", undefined), false);
});

/* ── Discount ledger: parity with the live plugin ────────────────────── */

/*
 * Sample registrations run through the LIVE plugin's own functions on
 * 25 Nov 2026 13:45:31 UTC (Novamira execute-php, read-only, nothing written):
 * IQU_Database::is_active_student, IQU_Discount_Ledger::item_for and
 * ::first_month, IQU_Billing_Service::free_month_end. Plugin column names; the
 * base row is a public, enrolled Qaidah student, 5 days, created 2026-09-10.
 * `counts` = active && item && first_month <= the current month (DL:275).
 */
const PLUGIN_NOW = new Date(1795614331 * 1000);
const BASE = {
  form_type: "free",
  status: "enrolled",
  created_via: "public",
  existing_student: 0,
  archived_at: null as string | null,
  billing_ended_at: null as string | null,
  course_type: "qaidah",
  days_per_week: 5,
  discount_amount: 0,
  calculated_amount: 0,
  coupon_id: 0,
  special_discount: 0,
  zakat_declaration: 0,
  flexible_fee_note: "",
  agreed_fee: null as number | null,
  agreed_fee_fund: "",
  fee_pref: "",
  created_at: "2026-09-10 12:00:00",
  updated_at: "2026-11-20 10:00:00",
};
type PluginRow = Partial<typeof BASE> & Record<string, unknown>;
type Expected = { active: boolean; item: { kind: string; reason: string; amount: number } | null; first_month: string; free_month_end: string | null; counts: boolean };

const SAMPLES: Record<number, [PluginRow, Expected]> = {
  1: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1 }, { active: true, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  2: [{ discount_amount: 16, special_discount: 1 }, { active: true, item: { kind: "special", reason: "special_plan", amount: 16 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  3: [{ course_type: "hifz", days_per_week: 3, agreed_fee: 25, agreed_fee_fund: "special" }, { active: true, item: { kind: "special", reason: "agreed_fee", amount: 35 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  4: [{ course_type: "hifz", days_per_week: 3, agreed_fee: 25, agreed_fee_fund: "" }, { active: true, item: null, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  5: [{ agreed_fee: 95, agreed_fee_fund: "zakat" }, { active: true, item: null, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  6: [{ discount_amount: 40, coupon_id: 4, zakat_declaration: 1, agreed_fee: 30, agreed_fee_fund: "zakat" }, { active: true, item: { kind: "zakat", reason: "agreed_fee", amount: 50 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  7: [{ discount_amount: 20, agreed_fee_fund: "zakat" }, { active: true, item: { kind: "zakat", reason: "admin_discount", amount: 20 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  8: [{ discount_amount: 20 }, { active: true, item: null, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  9: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1, existing_student: 1, created_at: "2026-11-20 09:00:00" }, { active: true, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2026-11-01", free_month_end: null, counts: true }],
  10: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1, created_at: "2026-11-05 09:00:00" }, { active: true, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2027-01-01", free_month_end: "2026-12-05", counts: false }],
  11: [{ discount_amount: 16, special_discount: 1, created_via: "admin", created_at: "2026-10-31 20:00:00" }, { active: true, item: { kind: "special", reason: "special_plan", amount: 16 }, first_month: "2026-11-01", free_month_end: null, counts: true }],
  12: [{ discount_amount: 16, special_discount: 1, created_via: "admin", created_at: "2026-10-31 17:00:00" }, { active: true, item: { kind: "special", reason: "special_plan", amount: 16 }, first_month: "2026-10-01", free_month_end: null, counts: true }],
  13: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1, status: "cancelled" }, { active: false, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  14: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1, archived_at: "2026-11-02 10:00:00" }, { active: false, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  15: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1, billing_ended_at: "2026-10-31 17:59:59" }, { active: false, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  16: [{ discount_amount: 40, coupon_id: 3, zakat_declaration: 1, billing_ended_at: "2026-10-31 18:00:00" }, { active: true, item: { kind: "zakat", reason: "coupon", amount: 40 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  17: [{ form_type: "weekend_new", discount_amount: 10, agreed_fee_fund: "zakat" }, { active: true, item: null, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  18: [{ course_type: "", days_per_week: 3, fee_pref: "custom_25", agreed_fee: 15, agreed_fee_fund: "special" }, { active: true, item: { kind: "special", reason: "agreed_fee", amount: 10 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  19: [{ discount_amount: 500, coupon_id: 5, zakat_declaration: 1 }, { active: true, item: { kind: "zakat", reason: "coupon", amount: 80 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  20: [{ days_per_week: 0, discount_amount: 40, coupon_id: 3, zakat_declaration: 1 }, { active: true, item: null, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  21: [{ course_type: "nope", discount_amount: 40, coupon_id: 3, zakat_declaration: 1 }, { active: true, item: null, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: false }],
  22: [{ created_via: "import", discount_amount: 80, coupon_id: 6, zakat_declaration: 1, created_at: "2026-11-24 19:30:00" }, { active: true, item: { kind: "zakat", reason: "coupon", amount: 80 }, first_month: "2026-11-01", free_month_end: null, counts: true }],
  23: [{ course_type: "arabic", days_per_week: 4, agreed_fee: 0, agreed_fee_fund: "zakat" }, { active: true, item: { kind: "zakat", reason: "agreed_fee", amount: 80 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  24: [{ course_type: "islamic_studies", days_per_week: 2, discount_amount: 12, flexible_fee_note: "x", agreed_fee_fund: "special" }, { active: true, item: { kind: "special", reason: "admin_discount", amount: 12 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
  25: [{ days_per_week: 3, discount_amount: 8.5, special_discount: 1, calculated_amount: 50 }, { active: true, item: { kind: "special", reason: "special_plan", amount: 8.5 }, first_month: "2026-11-01", free_month_end: "2026-10-10", counts: true }],
};

const cents = (dollars: number) => Math.round(dollars * 100);

/** The plugin row as our registrations row (column mapping of architecture §1.2). */
function fromPlugin(id: number, over: PluginRow): RegInsert {
  const r = { ...BASE, ...over };
  return {
    id,
    program: r.form_type === "free" ? "monthly" : String(r.form_type),
    status: r.status,
    createdVia: r.created_via,
    firstName: "Sample",
    lastName: `Row ${id}`,
    email: `sample${id}@example.com`,
    existingStudent: r.existing_student ? true : false,
    archivedAt: r.archived_at ? utc(r.archived_at) : null,
    billingEndedAt: r.billing_ended_at ? utc(r.billing_ended_at) : null,
    courseKey: r.course_type || null,
    daysPerWeek: r.days_per_week || null,
    discountCents: cents(r.discount_amount),
    calculatedCents: r.calculated_amount ? cents(r.calculated_amount) : null,
    couponId: r.coupon_id || null,
    specialPlan: Boolean(r.special_discount),
    zakatDeclaration: Boolean(r.zakat_declaration),
    flexibleFeeNote: r.flexible_fee_note || null,
    agreedFeeCents: r.agreed_fee === null ? null : cents(r.agreed_fee),
    agreedFeeFund: r.agreed_fee_fund || null,
    legacyFeePref: r.fee_pref || null,
    createdAt: utc(r.created_at),
    updatedAt: utc(r.updated_at),
  };
}

async function seedSamples(): Promise<Map<number, Reg>> {
  for (const id of [3, 4, 5, 6]) await addCoupon(id);
  const out = new Map<number, Reg>();
  for (const [k, [row]] of Object.entries(SAMPLES)) {
    const [reg] = await db.insert(registrations).values(fromPlugin(990000 + Number(k), row)).returning();
    out.set(Number(k), reg);
  }
  return out;
}

test("ledger parity: every sample gives the plugin's own answer (active, fund, reason, amount, first month)", async () => {
  const regs = await seedSamples();
  for (const [k, [, want]] of Object.entries(SAMPLES)) {
    const reg = regs.get(Number(k))!;
    const item = ledgerItem(reg);
    const got = {
      active: isActiveStudent(reg, PLUGIN_NOW),
      item: item ? { kind: item.kind, reason: item.reason, amount: item.amountCents / 100 } : null,
      first_month: firstMonth(reg, null, 1),
      free_month_end: freeMonthEnd(reg),
    };
    const counts = got.active && got.item !== null && got.first_month <= "2026-11-01";
    assert.deepEqual({ ...got, counts }, want, `sample ${k}`);
  }
});

test("ledger parity: the daily job writes exactly the plugin's rows for November 2026, in cents", async () => {
  await seedSamples();
  const report = await runLedger(db, PLUGIN_NOW, { mode: "test", billingDay: 1 });
  const want = Object.entries(SAMPLES)
    .filter(([, [, e]]) => e.counts)
    .map(([k, [, e]]) => [990000 + Number(k), e.item!.kind, e.item!.reason, cents(e.item!.amount)]);
  const rows = await db.select().from(discountLedger).orderBy(asc(discountLedger.registrationId));
  assert.deepEqual(rows.map((r) => [r.registrationId, r.kind, r.reason, r.amountCents]), want);
  assert.ok(rows.every((r) => r.month === "2026-11-01" && r.source === "monthly" && Number.isInteger(r.amountCents)));
  assert.deepEqual(report, { month: "2026-11-01", counted: want.length, inserted: want.length, updated: 0 });
  // Totals per fund, as the Zakat & Discount report adds them.
  const total = (kind: string) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.amountCents, 0);
  assert.equal(total("zakat"), 4000 + 5000 + 2000 + 4000 + 4000 + 8000 + 8000 + 8000);
  assert.equal(total("special"), 1600 + 3500 + 1600 + 1600 + 1000 + 1200 + 850);
});

test("ledger: re-running is safe; the current month follows a fee change, past months never move", async () => {
  await addCoupon(3);
  const reg = await addReg({ couponId: 3, zakatDeclaration: true, discountCents: 4000, createdVia: "admin", createdAt: at("2026-09-01T00:00:00Z") });
  // October was written last month (and an imported row is kept as it is).
  await db.insert(discountLedger).values({ month: "2026-10-01", registrationId: reg.id, kind: "zakat", reason: "coupon", amountCents: 4000, source: "wp_import" });

  const first = await runLedger(db, at("2026-11-10T06:00:00Z"), { mode: "test", billingDay: 1 });
  const again = await runLedger(db, at("2026-11-11T06:00:00Z"), { mode: "test", billingDay: 1 });
  assert.deepEqual([first.inserted, first.updated, again.inserted, again.updated], [1, 0, 0, 1]);

  // The coupon now covers less: November's row follows (DL:298-301); October stays.
  await db.update(registrations).set({ discountCents: 2400 }).where(eq(registrations.id, reg.id));
  await runLedger(db, at("2026-11-20T06:00:00Z"), { mode: "test", billingDay: 1 });
  const rows = await db.select().from(discountLedger).orderBy(asc(discountLedger.month));
  assert.deepEqual(rows.map((r) => [r.month, r.amountCents, r.source]), [["2026-10-01", 4000, "wp_import"], ["2026-11-01", 2400, "monthly"]]);

  // Two runs at the same moment still leave one row per month and fund (unique key).
  await Promise.all([runLedger(db, at("2026-11-21T06:00:00Z"), { mode: "test", billingDay: 1 }), runLedger(db, at("2026-11-21T06:00:00Z"), { mode: "test", billingDay: 1 })]);
  assert.equal((await db.select().from(discountLedger)).length, 2);
});

test("ledger: the 1st of the month in Dhaka, and a free month ending into the next month", async () => {
  await addCoupon(3);
  // A website student created on 1 Nov (Dhaka): the free month ends 1 Dec, so the first charge and first row is December.
  const fresh = await addReg({ couponId: 3, zakatDeclaration: true, discountCents: 4000, createdAt: at("2026-10-31T19:00:00Z") });
  assert.equal(freeMonthEnd(fresh), "2026-12-01");
  assert.equal(firstMonth(fresh, null, 1), "2026-12-01");

  // 23:59 on 30 Nov in Dhaka: still November, nothing for this student yet.
  const nov = await runLedger(db, at("2026-11-30T17:59:00Z"), { mode: "test", billingDay: 1 });
  assert.deepEqual([nov.month, nov.counted], ["2026-11-01", 0]);
  // 00:30 on 1 Dec in Dhaka (18:30 UTC on 30 Nov, when the cron runs): December's row is written on the 1st.
  const dec = await runLedger(db, at("2026-11-30T18:30:00Z"), { mode: "test", billingDay: 1 });
  assert.deepEqual([dec.month, dec.counted, dec.inserted], ["2026-12-01", 1, 1]);
  const [row] = await db.select().from(discountLedger);
  assert.deepEqual([row.month, row.kind, row.amountCents], ["2026-12-01", "zakat", 4000]);
});

test("ledger: the family's billing day and a sibling's own first charge decide the first month (BS:526-541)", async () => {
  assert.equal(billingDayOnOrAfter("2026-10-10", 1), "2026-11-01");
  assert.equal(billingDayOnOrAfter("2026-10-10", 15), "2026-10-15");
  assert.equal(billingDayOnOrAfter("2026-01-31", 28), "2026-02-28");
  assert.equal(billingDayOnOrAfter("2026-12-20", 5), "2027-01-05");
  const reg = await addReg({ createdAt: at("2026-09-10T12:00:00Z") }); // free month ends 10 Oct
  assert.equal(firstMonth(reg, { memberFirstCharge: "2027-02-01", familyFirstCharge: "2026-11-01" }, 1), "2027-02-01", "the sibling's own first charge wins");
  assert.equal(firstMonth(reg, { memberFirstCharge: null, familyFirstCharge: "2026-10-01" }, 1), "2026-11-01", "never before the billing day after the free month");
  assert.equal(firstMonth(reg, { memberFirstCharge: null, familyFirstCharge: "2026-12-15" }, 1), "2026-12-01", "the family's later first charge");
  assert.equal(firstMonth(reg, null, 15), "2026-10-01", "billing day 15 → 15 Oct");
});

test("ledger: a student removed from billing counts to the last month paid (DL:216-232, DL:276-277)", async () => {
  await addCoupon(3);
  const reg = await addReg({ couponId: 3, zakatDeclaration: true, discountCents: 4000, createdVia: "admin", createdAt: at("2026-08-01T00:00:00Z"), billingEndedAt: at("2026-11-05T00:00:00Z") });
  // A paid student's Stripe line was removed in November: classes run to the end of October's period, November is not paid.
  await db.insert(auditLog).values({ actor: "admin", action: "remove_student", entity: "registration", entityId: String(reg.id), registrationId: reg.id, stripeRef: "si_123", at: at("2026-11-05T00:00:00Z") });
  assert.equal((await runLedger(db, at("2026-11-10T06:00:00Z"), { mode: "test", billingDay: 1 })).counted, 0);
  // A full-scholarship removal (no Stripe line) counts its own month.
  await db.insert(auditLog).values({ actor: "admin", action: "remove_student", entity: "registration", entityId: String(reg.id), registrationId: reg.id, stripeRef: null, at: at("2026-11-06T00:00:00Z") });
  assert.equal((await runLedger(db, at("2026-11-10T06:00:00Z"), { mode: "test", billingDay: 1 })).counted, 1);
});

test("ledger: only enrolled monthly students count; Weekend and Summer never write a row", async () => {
  await addReg({ program: "weekend_new", agreedFeeFund: "zakat", discountCents: 1000, createdVia: "admin" });
  await addReg({ program: "summer_l1", status: "paid", agreedFeeFund: "zakat", discountCents: 1000, createdVia: "admin" });
  await addReg({ status: "card_pending", specialPlan: true, discountCents: 1600, createdVia: "admin" });
  const r = await runLedger(db, at("2026-11-10T06:00:00Z"), { mode: "test", billingDay: 1 });
  assert.equal(r.counted, 0);
  assert.equal(currentItems([], "2026-11-01", at("2026-11-10T06:00:00Z"), 1).length, 0);
});

/* ── Card reminders and expiry ───────────────────────────────────────── */

const NOW = at("2026-11-25T14:00:00Z");
const LINK = "https://checkout.stripe.com/c/pay/cs_test_123";
const withLink = { mode: "test" as const, cardLink: () => LINK };

async function cardPending(ageHours: number, over: Partial<RegInsert> = {}, fam: Partial<typeof families.$inferInsert> = {}) {
  const reg = await addReg({ status: "card_pending", createdAt: new Date(NOW.getTime() - ageHours * H), ...over });
  const family = await addFamily(fam);
  await link(reg.id, family.id, "2027-01-01");
  return reg;
}

const emails = async () => (await db.select().from(outbox).where(eq(outbox.kind, "email")).orderBy(asc(outbox.id))).map((r) => r.dedupeKey);
const bitsOf = async (id: number) => (await db.select().from(registrations).where(eq(registrations.id, id)))[0].remindersSent;

test("reminders: 24 h, then the last one at 72 h, each once (EN:351-397)", async () => {
  const young = await cardPending(23);
  const day1 = await cardPending(25);
  const r1 = await runCardReminders(db, NOW, withLink);
  assert.deepEqual([r1.reminded24, r1.reminded72], [1, 0]);
  assert.equal(await bitsOf(young.id), 0, "under 24 h: nothing yet");
  assert.equal(await bitsOf(day1.id), 1);

  // The same run again: nothing new (claim bits + dedupe).
  const again = await runCardReminders(db, NOW, withLink);
  assert.deepEqual([again.reminded24, again.reminded72], [0, 0]);

  // 50 hours later the same family is past 72 h: the last reminder, once.
  const later = new Date(NOW.getTime() + 50 * H);
  const r2 = await runCardReminders(db, later, withLink);
  assert.equal(r2.reminded72, 2, "day1 (75 h) and young (73 h)");
  assert.equal(await bitsOf(day1.id), 3);
  assert.equal((await runCardReminders(db, later, withLink)).reminded72, 0);
  assert.deepEqual(await emails(), [`card-reminder:${day1.id}:24h`, `card-reminder:${young.id}:72h`, `card-reminder:${day1.id}:72h`]);

  const [mail] = await db.select().from(outbox).where(eq(outbox.dedupeKey, `card-reminder:${young.id}:72h`));
  const p = mail.payload as { subject: string; html: string; to: string };
  assert.equal(p.subject, "Last reminder: finish Ayesha’s enrollment");
  assert.ok(p.html.includes(LINK) && p.html.includes("Finish enrollment") && p.html.includes("this enrollment will close in a few days"));
});

test("reminders: past 72 h with none sent, only the last one goes, and both bits are set (EN:393-394)", async () => {
  const reg = await cardPending(80);
  const r = await runCardReminders(db, NOW, withLink);
  assert.deepEqual([r.reminded24, r.reminded72], [0, 1]);
  assert.equal(await bitsOf(reg.id), 3);
});

test("reminders: no reminder without a link (P2), for admin rows, with a card on file, or while billing", async () => {
  const noLink = await cardPending(30);
  const r = await runCardReminders(db, NOW, { mode: "test", cardLink: () => null });
  assert.deepEqual([r.reminded24, r.noLink], [0, 1]);
  assert.equal(await bitsOf(noLink.id), 0, "not claimed, so it goes out on the first run with a link");

  await cardPending(30, { createdVia: "admin" });
  await cardPending(30, {}, { stripeSubscriptionId: "sub_123" });
  await cardPending(30, {}, { status: "free_month" });
  const r2 = await runCardReminders(db, NOW, withLink);
  assert.equal(r2.reminded24, 1, "only the first one, now that it has a link");
  assert.equal(r2.checked, 3, "three public rows; the admin row is skipped before it is checked (EN:368)");
});

test("expiry: card_pending → expired after 7 days with an audit row; a card on file or a re-run changes nothing", async () => {
  const old = await cardPending(7 * 24 + 1);
  const withCard = await cardPending(9 * 24, {}, { stripeSubscriptionId: "sub_999" });
  const sixDays = await cardPending(6 * 24);
  const r = await runCardReminders(db, NOW, withLink);
  assert.equal(r.expired, 1);
  const status = async (id: number) => (await db.select().from(registrations).where(eq(registrations.id, id)))[0].status;
  assert.equal(await status(old.id), "expired");
  assert.equal(await status(withCard.id), "card_pending");
  assert.equal(await status(sixDays.id), "card_pending");
  const audit = await db.select().from(auditLog);
  assert.equal(audit.length, 1);
  assert.deepEqual([audit[0].actor, audit[0].action, audit[0].registrationId, audit[0].before, audit[0].after], ["system:card-expiry", "expire_card_step", old.id, { status: "card_pending" }, { status: "expired" }]);
  assert.equal((await runCardReminders(db, NOW, withLink)).expired, 0);
  assert.equal((await db.select().from(auditLog)).length, 1);
});

test("expiry: a webhook that enrolled the family in between wins (conditional update)", async () => {
  const reg = await cardPending(8 * 24);
  await db.update(registrations).set({ status: "enrolled" }).where(eq(registrations.id, reg.id));
  assert.equal((await runCardReminders(db, NOW, withLink)).expired, 0);
  assert.equal((await db.select().from(auditLog)).length, 0);
});

test("reminders: two runs at the same time send each email once", async () => {
  await cardPending(30);
  const [a, b] = await Promise.all([runCardReminders(db, NOW, withLink), runCardReminders(db, NOW, withLink)]);
  assert.equal(a.reminded24 + b.reminded24, 1);
  assert.equal((await emails()).length, 1);
});

test("guard: outside production a reminder goes only to EMAIL_ALLOWLIST; others are logged and skipped", async () => {
  await cardPending(30, { email: "family@example.com" });
  await cardPending(30, { email: "tester@example.org" });
  const r = await runCardReminders(db, NOW, withLink);
  resetGmailTokenCache();
  const gmail: GmailConfig = {
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "refresh",
    sender: "ilmulquranusa@gmail.com",
    production: false,
    allowlist: parseAllowlist("tester@example.org"),
  };
  const sent: string[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
    sent.push(String(init?.body ?? ""));
    return new Response(JSON.stringify({ id: "m1" }), { status: 200 });
  }) as typeof fetch;
  const report = await deliverOutbox(db, { telegram: null, gmail, fromName: "Ilm-Ul-Quran USA", fetchImpl }, { ids: r.outboxIds, now: NOW });
  assert.deepEqual([report.sent, report.skipped], [1, 1]);
  assert.equal(sent.length, 1);
});

/* ── Daily summary ───────────────────────────────────────────────────── */

const NINE_PM = at("2026-11-25T15:00:00Z"); // 21:00 Asia/Dhaka
const DONATIONS: Donations = { count: 2, netCents: 7500, donors: 2, monthCents: 124300 };
const deps = (over: Partial<SummaryDeps> = {}): SummaryDeps => ({ mode: "test", donations: DONATIONS, cardStepProblem: "", freePaymentStep: true, ...over });
const rowMap = (rows: [string, string][]) => Object.fromEntries(rows);

test("summary: one message at 9 PM Dhaka, in the plugin's order, with N18 fixed", async () => {
  const since = (h: number) => new Date(NINE_PM.getTime() - h * H);
  await addReg({ status: "pending", program: "weekend_new", createdAt: since(2) }); // pending: NOT awaiting review (N18)
  await addReg({ status: "pending_review", createdAt: since(3) });
  await addReg({ status: "pending_review", createdAt: since(50) });
  await addReg({ status: "pending_review", createdAt: since(60), archivedAt: since(10) }); // archived: not awaiting
  await addReg({ status: "enrolled", createdVia: "import", createdAt: since(1) }); // an import is not a new registration
  await recordBlock(db, "PK", "monitor", since(5));
  await recordBlock(db, "PK", "monitor", since(4));
  await recordBlock(db, "GB", "monitor", since(4));
  await recordBlock(db, "IN", "monitor", since(30)); // older than 24 h

  const s = await buildDailySummary(db, NINE_PM, deps());
  assert.equal(s.title, "📊 Daily Summary — 25 Nov 2026, 9:00 PM Dhaka time");
  const m = rowMap(s.rows);
  assert.equal(m["Donations"], "2 ($75.00)");
  assert.equal(m["Donors"], "2");
  assert.equal(m["Registrations"], "2", "the weekend and the new review row; not the import");
  assert.equal(m["Month to date"], "$1,243.00");
  assert.equal(m["Awaiting review"], "2 pending registrations", "pending_review, not pending (N18); archived left out");
  assert.equal(m["Would be blocked (monitor)"], "3 (PK 2, GB 1)");
  assert.equal(m["New — pending review"], "1");
  assert.deepEqual(
    s.rows.map(([k]) => k).slice(0, 6),
    ["Donations", "Donors", "Registrations", "Month to date", "Awaiting review", "Would be blocked (monitor)"],
  );
  assert.equal(s.footer, "Covers the last 24 hours.");
  assert.ok(!/@|Ayesha|Student/.test(s.html), "counts and totals only: no names, no emails");
});

test("summary: tuition lines in test mode carry [test]; chase and enrollment lines (BSU, CH, EN)", async () => {
  const famActive = await addFamily({ status: "active", monthlyCents: 8000, netCents: 8000 });
  const famLink = await addFamily({ status: "link_sent", emailSentAt: new Date(NINE_PM.getTime() - 9 * D) });
  await addFamily({ status: "past_due", monthlyCents: 4800, netCents: 4800 });
  await addFamily({ status: "free_month", nextChargeAt: new Date(NINE_PM.getTime() + 3 * D) });
  await addFamily({ mode: "live", status: "active", monthlyCents: 9999, netCents: 9999 }); // the other mode never counts
  await db.insert(payments).values([
    { stripeInvoiceId: "in_today", familyId: famActive.id, mode: "test", status: "paid", amountDueCents: 8000, amountPaidCents: 8000, paidAt: new Date(NINE_PM.getTime() - 2 * H) },
    { stripeInvoiceId: "in_free", familyId: famActive.id, mode: "test", status: "paid", amountDueCents: 0, amountPaidCents: 0, paidAt: new Date(NINE_PM.getTime() - 2 * H) },
    { stripeInvoiceId: "in_early", familyId: famActive.id, mode: "test", status: "paid", amountDueCents: 4000, amountPaidCents: 4000, paidAt: at("2026-11-01T02:00:00Z") },
    { stripeInvoiceId: "in_october", familyId: famActive.id, mode: "test", status: "paid", amountDueCents: 4000, amountPaidCents: 4000, paidAt: at("2026-10-31T17:00:00Z") }, // 23:00 Dhaka, 31 Oct
  ]);
  await db.insert(stripeEvents).values({ stripeEventId: "evt_fail1", mode: "test", type: "invoice.payment_failed", receivedAt: new Date(NINE_PM.getTime() - H) });

  const ago = (h: number) => new Date(NINE_PM.getTime() - h * H);
  const linked = await addReg({ status: "enrolled", createdAt: ago(10 * 24) });
  await link(linked.id, famLink.id);
  await addReg({ status: "enrolled", createdVia: "admin", createdAt: ago(5 * 24) }); // billable, no family: Not set up, over 3 days
  await addReg({ status: "enrolled", createdVia: "admin", courseKey: null, legacyFeePref: null, createdAt: ago(1) }); // needs a course
  await addReg({ status: "pending_review", createdVia: "public", createdAt: ago(2) });
  const waiting = await addReg({ status: "card_pending", createdVia: "public", createdAt: ago(2) });
  await link(waiting.id, famActive.id);

  const s = await buildDailySummary(db, NINE_PM, deps({ cardStepProblem: "the Stripe card step is not connected yet." }));
  const m = rowMap(s.rows);
  assert.equal(m["Tuition paid [test]"], "1 ($80.00)", "a $0 free-month invoice is not tuition");
  assert.equal(m["Tuition failed [test]"], "1");
  assert.equal(m["Payment problems [test]"], "1 — contact the families");
  assert.equal(m["No card yet [test]"], "1 (1 over 7 days)");
  assert.equal(m["Free month ending [test]"], "1 this week");
  assert.equal(m["On billing [test]"], "3 families · $128.00/month");
  assert.equal(m["Tuition this month [test]"], "$120.00", "from 1 Nov 00:00 in Dhaka: 31 Oct 23:00 Dhaka is October");
  assert.equal(m["No billing — Not set up"], "1 (1 over 3 days)");
  assert.equal(m["No billing — Needs course"], "1");
  assert.equal(m["No billing — Pending review"], "1");
  assert.equal(m["Link sent, no card (over 7 days)"], "1");
  assert.equal(m["⚠️ Card step"], "Enroll for Free payment is On, but families cannot add a card: the Stripe card step is not connected yet.");
  assert.equal(m["Waiting for a card"], "1");
  assert.equal(m["Enrollments started"], "1");
  const order = s.rows.map(([k]) => k);
  assert.ok(order.indexOf("Tuition paid [test]") < order.indexOf("No billing — Not set up"));
  assert.ok(order.indexOf("⚠️ Card step") < order.indexOf("Enrollments started"));
});

test("summary: donations off or failing reads 'not available today'; on, it is signed and parsed", async () => {
  const off = await buildDailySummary(db, NINE_PM, deps({ donations: await fetchDonations(null, { since: NINE_PM, now: NINE_PM }) }));
  assert.equal(rowMap(off.rows)["Donations"], "not available today");
  assert.ok(!("Donors" in rowMap(off.rows)) && !("Month to date" in rowMap(off.rows)));
  assert.equal(off.footer, "Covers the last 24 hours.", "never a 'quiet day' when donations are unknown");

  const config = { url: "https://ilmulquranus.org/wp-json/iqu/v1/summary/donations", secret: "s".repeat(40) };
  const window = { since: new Date(NINE_PM.getTime() - D), now: NINE_PM };
  let seen: { url: string; headers: Headers } | null = null;
  const good = (async (url: string | URL, init?: RequestInit) => {
    seen = { url: String(url), headers: new Headers(init?.headers) };
    return new Response(JSON.stringify({ count: 3, net_cents: 12500, donors: 2, month_cents: 99000 }), { status: 200 });
  }) as typeof fetch;
  const d = await fetchDonations(config, window, good);
  assert.deepEqual(d, { count: 3, netCents: 12500, donors: 2, monthCents: 99000 });
  const u = new URL(seen!.url);
  assert.equal(u.searchParams.get("since"), String(window.since.getTime() / 1000));
  assert.equal(u.searchParams.get("month_start"), String(Date.UTC(2026, 10, 1) / 1000));
  const ts = Number(seen!.headers.get("x-iqu-timestamp"));
  assert.equal(seen!.headers.get("x-iqu-signature"), signRequest(config.secret, ts, `${u.pathname}${u.search}`));

  for (const failing of [
    (async () => new Response("oops", { status: 500 })) as typeof fetch,
    (async () => new Response(JSON.stringify({ count: "3" }), { status: 200 })) as typeof fetch,
    (async () => new Response("not json", { status: 200 })) as typeof fetch,
    (async () => {
      throw new Error("network down");
    }) as typeof fetch,
  ]) {
    assert.equal(await fetchDonations(config, window, failing), null);
  }
});

test("summary: a quiet day says so; a tuition payment means it is not quiet (N:362-365, BSU:104-111)", async () => {
  const quiet = await buildDailySummary(db, NINE_PM, deps({ donations: { count: 0, netCents: 0, donors: 0, monthCents: 0 } }));
  assert.equal(quiet.footer, "A quiet day — nothing came in.");
  const fam = await addFamily({ status: "active", monthlyCents: 8000, netCents: 8000 });
  await db.insert(payments).values({ stripeInvoiceId: "in_q1", familyId: fam.id, mode: "test", status: "paid", amountDueCents: 8000, amountPaidCents: 8000, paidAt: new Date(NINE_PM.getTime() - H) });
  const paid = await buildDailySummary(db, NINE_PM, deps({ donations: { count: 0, netCents: 0, donors: 0, monthCents: 0 } }));
  assert.equal(paid.footer, "Covers the last 24 hours.");
});

test("summary: one message per Dhaka day — a re-run sends nothing; 00:30 Dhaka is the next day", async () => {
  const first = await runDailySummary(db, NINE_PM, deps());
  const again = await runDailySummary(db, new Date(NINE_PM.getTime() + 2 * H), deps()); // 23:00 Dhaka, same day
  const next = await runDailySummary(db, at("2026-11-25T18:30:00Z"), deps()); // 00:30 on 26 Nov in Dhaka
  assert.deepEqual([first.day, first.outboxIds.length, again.outboxIds.length, next.day, next.outboxIds.length], ["2026-11-25", 1, 0, "2026-11-26", 1]);
});

test("guard: the summary goes only to the test chat outside production, never the live chat", async () => {
  const { outboxIds } = await runDailySummary(db, NINE_PM, deps());
  const chats: string[] = [];
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    chats.push(JSON.parse(String(init?.body)).chat_id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  const r = await deliverOutbox(db, { telegram: telegramStaging(), gmail: null, fromName: "x", fetchImpl }, { ids: outboxIds, now: NINE_PM });
  assert.equal(r.sent, 1);
  assert.deepEqual(chats, ["-100111"]);
  // The live chat as TELEGRAM_CHAT_ID is refused (fail closed), so nothing reaches it.
  const live = telegramConfig(env({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "-100999", NEXT_PUBLIC_SITE_ENV: "staging" }), "^-100999$");
  const again = await runDailySummary(db, at("2026-11-26T15:00:00Z"), deps());
  const r2 = await deliverOutbox(db, { telegram: live, gmail: null, fromName: "x", fetchImpl }, { ids: again.outboxIds, now: at("2026-11-26T15:00:00Z") });
  assert.deepEqual([r2.sent, r2.skipped, chats.length], [0, 1, 1]);
});

test("blocks: hourly counts per country, pruned after 8 days, no IP stored", async () => {
  await recordBlock(db, "PK", "enforce", at("2026-11-25T10:15:00Z"));
  await recordBlock(db, "PK", "enforce", at("2026-11-25T10:45:00Z"));
  await recordBlock(db, "nope", "weird", at("2026-11-25T10:50:00Z"));
  const rows = await db.select().from(eligibilityBlocks).orderBy(asc(eligibilityBlocks.country));
  assert.deepEqual(rows.map((r) => [r.hour.toISOString(), r.mode, r.country, r.count]), [
    ["2026-11-25T10:00:00.000Z", "monitor", "??", 1],
    ["2026-11-25T10:00:00.000Z", "enforce", "PK", 2],
  ]);
  await recordBlock(db, "GB", "monitor", at("2026-12-03T11:00:00Z")); // 8 days + 1 hour later
  assert.deepEqual((await db.select().from(eligibilityBlocks)).map((r) => r.country), ["GB"]);
  assert.equal(money2(-500), "$-5.00", "PHP number_format keeps the sign after the $");
});
