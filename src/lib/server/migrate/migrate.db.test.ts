import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import { runLedger } from "../cron/ledger.ts";
import { row, snapshotOf, syntheticTables } from "./fixtures/snapshot.ts";
import { importSnapshot, liveStripeIds, type ImportReport } from "./importer.ts";
import { checkShape, KNOWN_COLUMNS, type Snapshot } from "./snapshot.ts";
import { country, e164 } from "./values.ts";

/*
 * P5 migration on a real Postgres (PGlite) with the real migrations, from a
 * SYNTHETIC snapshot shaped exactly like tooling/wp-export.php's output (the
 * live column list, MySQL text values, the export's checks). No real data.
 */

const { registrations, families, familyMembers, payments, arrears, stripeEvents, coupons, couponRedemptions, discountLedger, waitlist, auditLog, reviewReasons, wpImportRows } = schema;

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

const NOW = new Date("2027-01-14T15:30:00Z");
const prod = { dryRun: false, siteEnv: "production", now: NOW };
const table = (r: ImportReport, name: string) => r.tables.find((t) => t.table === name)!;
const okOrSay = (r: ImportReport) => assert.ok(r.ok, `expected ok, got:\n${r.mismatches.join("\n")}`);

/* ── Value conversions (the shapes found on the live site) ───────────── */

test("phones: the five shapes stored live become E.164; anything else is not guessed", () => {
  assert.equal(e164("+1 214 555 0101"), "+12145550101");
  assert.equal(e164("+12145550101"), "+12145550101");
  assert.equal(e164("+1 (214) 555-0101"), "+12145550101");
  assert.equal(e164("+44 20 7946 0958"), "+442079460958");
  assert.equal(e164("2145550103"), "+12145550103", "ten digits with no + is a US/Canada number");
  assert.equal(e164("0044 20 7946 0958"), "+442079460958");
  assert.equal(e164("+999"), null);
  assert.equal(e164("555-0101"), null);
  assert.equal(e164(""), null);
});

test("countries: every live spelling of the US maps to US; a typo or a city is kept as text with no code", () => {
  for (const v of ["United States", "USA", "US", "America", "United State of America", "United States of America", "Dallas tx", "California, USA", "Texas"]) {
    assert.equal(country(v).code, "US", v);
  }
  assert.deepEqual(country("Bangladesh"), { code: "BD", name: "Bangladesh" });
  assert.equal(country("Pakistan").code, "PK");
  assert.equal(country("United Kingdom").code, "GB");
  assert.equal(country("India").code, "IN");
  assert.equal(country("Malaysia").code, "MY");
  assert.equal(country("Myanmar").code, "MM");
  assert.equal(country("Canada").code, "CA");
  assert.deepEqual(country("Babgladesh"), { code: null, name: "Babgladesh" });
  assert.deepEqual(country("Dhaka"), { code: null, name: "Dhaka" });
  assert.deepEqual(country(""), { code: null, name: null });
});

/* ── Full import ─────────────────────────────────────────────────────── */

test("full import on production: every table, ids kept, Stripe linked by stored ids, money reconciled", async () => {
  const snap = snapshotOf(syntheticTables());
  const r = await importSnapshot(db, snap, prod);
  okOrSay(r);

  // Rows per table: source = imported.
  for (const t of ["iqu_coupons", "iqu_billing_accounts", "iqu_registrations", "iqu_billing_members", "iqu_billing_payments", "iqu_billing_arrears", "iqu_billing_events", "iqu_discount_ledger", "iqu_waitlist", "iqu_billing_actions"]) {
    const c = table(r, t);
    assert.deepEqual([c.inserted, c.skipped.length], [c.source, 0], t);
  }
  // IQU numbers and iqu_account_id kept.
  assert.deepEqual((await db.select({ id: registrations.id }).from(registrations).orderBy(asc(registrations.id))).map((x) => x.id), [101, 102, 103, 104, 105, 106, 107, 108]);
  assert.deepEqual((await db.select({ id: families.id }).from(families).orderBy(asc(families.id))).map((x) => x.id), [41, 42]);
  assert.deepEqual((await db.select({ id: coupons.id }).from(coupons)).map((x) => x.id), [7]);

  // Stripe: linked only by what the plugin stored. The webhook finds family 41 by iqu_account_id = families.id.
  const [f41] = await db.select().from(families).where(eq(families.id, 41));
  assert.deepEqual([f41.mode, f41.stripeCustomerId, f41.stripeSubscriptionId, f41.source, f41.linkTokenHash?.length], ["live", "cus_LiveZq41", "sub_LiveZq41", "wp_import", 64]);
  const [m1] = await db.select().from(familyMembers).where(eq(familyMembers.registrationId, 101));
  assert.deepEqual([m1.familyId, m1.stripeItemId, m1.amountCents, m1.firstChargeDate], [41, "si_LiveZq1", 2500, "2026-12-01"]);
  assert.deepEqual(r.stripe, { mode: "as-is", liveIdsInSnapshot: liveStripeIds(snap), familiesWithSubscription: 1, familiesLinkedByCustomer: 0, membersWithItem: 1 });

  // Registrations: every mapped value.
  const regs = new Map((await db.select().from(registrations)).map((x) => [x.id, x]));
  const r101 = regs.get(101)!;
  assert.deepEqual(
    [r101.program, r101.createdVia, r101.existingStudent, r101.agreedFeeCents, r101.agreedFeeFund, r101.familyId, r101.whatsappE164, r101.countryResCode, r101.countryResName, r101.countryOriginCode, r101.languages, r101.preferredDays, r101.sessionMinutes],
    ["monthly", "import", true, 2500, "special", 41, "+12145550101", "US", "USA", "BD", ["english", "bengali"], ["monday", "wednesday"], 30],
  );
  assert.deepEqual([regs.get(102)!.couponId, regs.get(102)!.zakatDeclaration, regs.get(102)!.discountCents], [7, true, 4800]);
  assert.deepEqual([regs.get(103)!.whatsappE164, regs.get(103)!.countryResCode], ["+12145550103", "US"]);
  assert.deepEqual([regs.get(104)!.program, regs.get(104)!.admissionFee, regs.get(104)!.paymentStatus, regs.get(104)!.paymentMethod, regs.get(104)!.timeSlotText, regs.get(104)!.legacyEnrollmentLevel], ["summer_l1", "flexible", "flexible", "zelle", "9:30 PM (local)", "level1"]);
  assert.equal(regs.get(105)!.program, "summer_l2");
  assert.deepEqual([regs.get(106)!.program, regs.get(106)!.status], ["weekend_existing", "cancelled"]);
  const r107 = regs.get(107)!;
  assert.deepEqual([r107.specialPlan, r107.checkoutSessionId, r107.whatsappE164, r107.countryResCode, r107.countryResName, r107.legacyDevice, r107.guardianContactE164], [true, "cs_live_ZqPay107", "+442079460958", null, "Babgladesh", "smartphone", "+8801711000000"]);
  const r108 = regs.get(108)!;
  assert.deepEqual([r108.archivedBy, r108.agreedFeeCents, r108.whatsappE164], ["wp:3", 0, null]);
  assert.match(r108.adminNote ?? "", /WhatsApp as entered: \+999/, "a value the schema cannot hold is kept word for word in the note");
  assert.ok(r.warnings.some((w) => /Babgladesh/.test(w)));
  for (const reg of regs.values()) assert.ok(reg.userAgent === null && reg.fbp === null && reg.fbc === null, "no user agent, fbp or fbc is copied");

  // Coupon redemptions rebuilt from the registrations that carry the coupon (= used_count 2).
  assert.deepEqual((await db.select().from(couponRedemptions).orderBy(asc(couponRedemptions.registrationId))).map((x) => [x.couponId, x.registrationId]), [[7, 102], [7, 105]]);
  // review_reason → rows; open while the registration waits for review.
  assert.deepEqual((await db.select().from(reviewReasons).orderBy(asc(reviewReasons.reason))).map((x) => [x.registrationId, x.reason, x.resolvedAt]), [[103, "existing_student", null], [103, "sibling", null]]);

  // Payments: '' is an older paid row (paid = its amount); a test-mode open invoice stays open.
  const pays = await db.select().from(payments).orderBy(asc(payments.stripeInvoiceId));
  assert.deepEqual(pays.map((p) => [p.stripeInvoiceId, p.status, p.amountPaidCents, p.familyId, p.mode]), [["in_LiveZq1", "paid", 8000, 41, "live"], ["in_LiveZq2", "paid", 4000, 41, "live"], ["in_TestZq3", "open", 0, 42, "test"]]);
  // Arrears: due → open, team → escalated, waived keeps its reason.
  assert.deepEqual((await db.select().from(arrears).orderBy(asc(arrears.month))).map((a) => [a.month, a.status, a.reason, a.amountCents]), [["2026-09-01", "escalated", null, 1000], ["2026-10-01", "waived", "Family hardship", 4800], ["2026-11-01", "open", null, 2500]]);
  // Events: results mapped, the original kept in the note; an unprocessed one is an error, not "in flight".
  assert.deepEqual((await db.select().from(stripeEvents).orderBy(asc(stripeEvents.stripeEventId))).map((e) => [e.stripeEventId, e.result, e.note]), [
    ["evt_LiveZq1", "not_iqu", "wp: no_account"],
    ["evt_LiveZq3", "error", "wp: received, never processed"],
    ["evt_TestZq2", "processed", "wp: ok · enrolled"],
  ]);
  // Waitlist: free → monthly, email lower case.
  assert.deepEqual((await db.select().from(waitlist)).map((w) => [w.email, w.program, w.country]), [["waiting@example.com", "monthly", "GB"]]);
  // Actions → audit_log, with a reason added where a money action had none.
  const audit = await db.select().from(auditLog).orderBy(asc(auditLog.id));
  assert.deepEqual(audit.map((a) => [a.actor, a.action, a.entity, a.registrationId, a.amountCents, a.stripeRef]), [["wp:3", "site_mode", "site", null, null, null], ["wp:3", "left", "registration", 101, null, null], ["wp:3", "remove_student", "registration", 102, 2500, "si_LiveZq9"]]);
  assert.equal(audit[2].reason, "(no reason recorded in WordPress)");

  // Ledger: copied as is, source wp_import; totals to the cent.
  const ledger = await db.select().from(discountLedger).orderBy(asc(discountLedger.month), asc(discountLedger.registrationId));
  assert.ok(ledger.every((l) => l.source === "wp_import"));
  const total = (k: string) => ledger.filter((l) => l.kind === k).reduce((a, l) => a + l.amountCents, 0);
  assert.deepEqual([total("zakat"), total("special")], [12800, 9400]);
  assert.ok(r.money.every((m) => m.ok));
  assert.deepEqual(r.money.find((m) => m.name === "Payments paid (cents)"), { name: "Payments paid (cents)", source: 12000, snapshot: 12000, target: 12000, ok: true });

  // Sequences continue above the highest imported id.
  assert.deepEqual([r.sequences.registrations, r.sequences.families, r.sequences.coupons], [109, 43, 8]);
  const [next] = await db.insert(registrations).values({ program: "monthly", firstName: "New", lastName: "Next", email: "new@example.com" }).returning({ id: registrations.id });
  assert.equal(next.id, 109, "the first Next enrollment gets IQU-109");
  const [fam] = await db.insert(families).values({ mode: "test", contactEmail: "n@example.com", studentType: "new" }).returning({ id: families.id });
  assert.equal(fam.id, 43);
});

test("dry run: the whole import runs, the report is complete, and nothing is kept", async () => {
  const r = await importSnapshot(db, snapshotOf(syntheticTables()), { ...prod, dryRun: true });
  okOrSay(r);
  assert.equal(table(r, "iqu_registrations").inserted, 8);
  assert.equal((await db.select().from(registrations)).length, 0);
  assert.equal((await db.select().from(wpImportRows)).length, 0);
  // setval survives a rollback, so a dry run never calls it: the next id is untouched.
  assert.equal(r.sequences.registrations, 109, "reported as it would be set");
  const [first] = await db.insert(registrations).values({ program: "monthly", firstName: "A", lastName: "B", email: "a@example.com" }).returning({ id: registrations.id });
  assert.equal(first.id, 1);
});

test("re-run: unchanged rows are left alone, a changed WordPress row is updated, totals never move", async () => {
  const tables = syntheticTables();
  okOrSay(await importSnapshot(db, snapshotOf(tables), prod));
  const again = await importSnapshot(db, snapshotOf(tables), prod);
  okOrSay(again);
  for (const t of again.tables) assert.deepEqual([t.inserted, t.updated, t.unchanged], [0, 0, t.source], t.table);

  // The delta run on switch day: one student changed in WordPress, one new student, one new ledger row.
  tables.iqu_registrations[0].last_name = "Zqrenamed";
  tables.iqu_registrations.push(row("iqu_registrations", { id: "120", first_name: "Zqnew", last_name: "Zqnew", email: "new120@example.com", status: "enrolled", created_via: "admin", course_type: "qaidah", days_per_week: "2" }));
  tables.iqu_discount_ledger.push(row("iqu_discount_ledger", { id: "6", month: "2026-12-01", registration_id: "101", kind: "special", reason: "agreed_fee", amount: "39.00" }));
  const delta = await importSnapshot(db, snapshotOf(tables), prod);
  okOrSay(delta);
  assert.deepEqual([table(delta, "iqu_registrations").updated, table(delta, "iqu_registrations").inserted], [1, 1]);
  assert.equal(table(delta, "iqu_discount_ledger").inserted, 1);
  assert.equal((await db.select().from(registrations).where(eq(registrations.id, 101)))[0].lastName, "Zqrenamed");
  assert.equal(delta.sequences.registrations, 121);
  const ledger = await db.select().from(discountLedger);
  assert.deepEqual([ledger.length, ledger.reduce((a, l) => a + l.amountCents, 0)], [6, 12800 + 9400 + 3900]);
});

test("ledger: imported rows are never recalculated; the P4 daily job leaves past months as they are", async () => {
  okOrSay(await importSnapshot(db, snapshotOf(syntheticTables()), prod));
  const before = await db.select().from(discountLedger).orderBy(asc(discountLedger.id));
  // The daily job in January (Dhaka) writes January only; October and November stay imported, untouched.
  await runLedger(db, new Date("2027-01-15T06:00:00Z"), { mode: "live", billingDay: 1 });
  const afterRows = await db.select().from(discountLedger).orderBy(asc(discountLedger.id));
  for (const b of before) assert.deepEqual(afterRows.find((a) => a.id === b.id), b);
  assert.ok(afterRows.filter((a) => a.id > before.length).every((a) => a.month === "2027-01-01" && a.source === "monthly"));
});

test("a target id already used by the new system is never overwritten: the import fails and keeps nothing", async () => {
  await db.insert(registrations).values({ id: 103, program: "monthly", firstName: "Next", lastName: "Row", email: "next@example.com" });
  const r = await importSnapshot(db, snapshotOf(syntheticTables()), prod);
  assert.equal(r.ok, false);
  assert.ok(r.mismatches.some((m) => /iqu_registrations: 1 row\(s\) skipped/.test(m)));
  assert.match(table(r, "iqu_registrations").skipped[0].reason, /registrations 103 already exists and was not imported/);
  assert.deepEqual((await db.select({ id: registrations.id }).from(registrations)).map((x) => x.id), [103], "rolled back: only the Next row is there");
});

test("mode guard: on staging the live Stripe ids are stripped, every count and total still reconciles", async () => {
  const snap = snapshotOf(syntheticTables());
  const r = await importSnapshot(db, snap, { ...prod, siteEnv: "staging" });
  okOrSay(r);
  assert.equal(r.stripe.mode, "stripped");
  assert.ok(r.stripe.liveIdsInSnapshot >= 8);
  assert.match(r.warnings[0], /live Stripe ids were stripped/);
  const [f41] = await db.select().from(families).where(eq(families.id, 41));
  assert.deepEqual([f41.mode, f41.stripeCustomerId, f41.stripeSubscriptionId, f41.linkTokenHash, f41.checkoutSessionId], ["live", null, null, null, null]);
  const [f42] = await db.select().from(families).where(eq(families.id, 42));
  assert.equal(f42.mode, "test", "test-mode rows are kept as they are");
  assert.deepEqual((await db.select().from(payments).orderBy(asc(payments.id))).map((p) => [p.stripeInvoiceId, p.hostedInvoiceUrl]), [["in_stripped1", null], ["in_stripped2", null], ["in_TestZq3", null]]);
  assert.deepEqual((await db.select().from(stripeEvents).orderBy(asc(stripeEvents.stripeEventId))).map((e) => e.stripeEventId), ["evt_TestZq2", "evt_stripped1", "evt_stripped3"]);
  assert.equal((await db.select().from(familyMembers).where(eq(familyMembers.registrationId, 101)))[0].stripeItemId, null);
  assert.equal((await db.select().from(registrations).where(eq(registrations.id, 107)))[0].checkoutSessionId, null);
  assert.equal((await db.select().from(arrears).where(eq(arrears.month, "2026-11-01")))[0].oldInvoiceId, null);
  assert.equal((await db.select().from(auditLog).where(eq(auditLog.action, "remove_student")))[0].stripeRef, null);
  // No live id anywhere in the staging database.
  const dump = JSON.stringify(await Promise.all([db.select().from(families), db.select().from(familyMembers), db.select().from(payments), db.select().from(stripeEvents), db.select().from(registrations), db.select().from(arrears), db.select().from(auditLog)]));
  assert.ok(!/(cus|sub|si|in|evt)_Live|cs_live_/.test(dump));
  assert.ok(r.money.every((m) => m.ok));
});

test("a snapshot with only test-mode ids imports as is on staging", async () => {
  const t = syntheticTables();
  t.iqu_billing_accounts = [t.iqu_billing_accounts[1]];
  t.iqu_billing_members = [t.iqu_billing_members[2]];
  t.iqu_billing_payments = [t.iqu_billing_payments[2]];
  t.iqu_billing_arrears = [t.iqu_billing_arrears[2]];
  t.iqu_billing_events = [t.iqu_billing_events[1]];
  t.iqu_billing_actions = [];
  for (const reg of t.iqu_registrations) {
    if (reg.billing_account_id === "41") reg.billing_account_id = "0";
    reg.pay_session_id = "";
  }
  const snap = snapshotOf(t);
  assert.equal(liveStripeIds(snap), 0);
  const r = await importSnapshot(db, snap, { ...prod, siteEnv: "staging" });
  okOrSay(r);
  assert.equal(r.stripe.mode, "as-is");
});

/* ── Refusals and mismatches ─────────────────────────────────────────── */

test("shape: a missing or unknown column, ip_address in the export, a count that disagrees, or the Zeffy table are refused", () => {
  const snap = snapshotOf(syntheticTables());
  const bad = structuredClone(snap) as Snapshot;
  bad.tables.iqu_registrations.columns = [...KNOWN_COLUMNS.iqu_registrations.filter((c) => c !== "agreed_fee"), "new_plugin_column", "ip_address"];
  bad.checks.count.iqu_waitlist = 99;
  bad.tables.iqu_zeffy_payments = { columns: ["id"], rows: [] };
  const problems = checkShape(bad);
  assert.ok(problems.some((p) => /columns missing: agreed_fee/.test(p)));
  assert.ok(problems.some((p) => /not mapped yet: new_plugin_column/.test(p)));
  assert.ok(problems.some((p) => /contains ip_address, which must never be copied/.test(p)));
  assert.ok(problems.some((p) => /iqu_waitlist: 1 rows in the snapshot but MySQL counted 99/.test(p)));
  assert.ok(problems.some((p) => /iqu_zeffy_payments: not an enrollment table/.test(p)));
  assert.deepEqual(checkShape(snap), []);
});

test("a coupon whose use count disagrees with the registrations, or a ledger total that does not reconcile, fails the run", async () => {
  const t = syntheticTables();
  t.iqu_coupons[0].used_count = "3";
  const r = await importSnapshot(db, snapshotOf(t), prod);
  assert.equal(r.ok, false);
  assert.ok(r.mismatches.some((m) => /coupon 7: used 3 times in WordPress, but 2 imported registrations carry it/.test(m)));

  // The export's MySQL sum and the rows disagree (a truncated or edited snapshot).
  const snap = snapshotOf(syntheticTables());
  snap.checks.ledger.zakat.cents += 1;
  const r2 = await importSnapshot(db, snap, prod);
  assert.equal(r2.ok, false);
  assert.ok(r2.mismatches.some((m) => /Ledger Zakat \(cents\): MySQL 12801, snapshot rows 12800, imported 12800/.test(m)));
  assert.equal((await db.select().from(discountLedger)).length, 0, "nothing kept");
});

test("skips: listed with their reasons and fail the run, unless --allow-skips; the ledger can never be partly imported", async () => {
  const t = syntheticTables();
  t.iqu_waitlist.push(row("iqu_waitlist", { id: "2", email: "x@example.com", program: "camp2030" }));
  const strict = await importSnapshot(db, snapshotOf(t), prod);
  assert.equal(strict.ok, false);
  assert.deepEqual(table(strict, "iqu_waitlist").skipped, [{ key: "2", reason: 'unknown program "camp2030"' }]);
  const allowed = await importSnapshot(db, snapshotOf(t), { ...prod, allowSkips: true });
  okOrSay(allowed);

  // A ledger row whose student is missing: skipped, and the totals can no longer reconcile, even with --allow-skips.
  const t2 = syntheticTables();
  t2.iqu_discount_ledger.push(row("iqu_discount_ledger", { id: "9", month: "2026-11-01", registration_id: "999", kind: "zakat", reason: "coupon", amount: "10.00" }));
  await client.exec(`TRUNCATE registrations, families, coupons, wp_import_rows RESTART IDENTITY CASCADE`);
  const r = await importSnapshot(db, snapshotOf(t2), { ...prod, allowSkips: true });
  assert.equal(r.ok, false);
  assert.ok(r.mismatches.some((m) => /Ledger Zakat \(cents\)/.test(m)));
});
