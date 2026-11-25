import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import { emptyDraft, type Draft } from "../../enroll/schema.ts";
import { hashKey } from "../keys.ts";
import { deliverOutbox, enqueue, MAX_ATTEMPTS, type Adapters } from "../outbox/outbox.ts";
import { parseAllowlist, resetGmailTokenCache, type GmailConfig } from "../outbox/gmail.ts";
import { telegramChatRefusal, telegramConfig, type TelegramConfig } from "../outbox/telegram.ts";
import { bump, LIMITS } from "../rate.ts";
import { declarationText } from "./coupon.ts";
import { GUARD_MESSAGES } from "./coupon-guard.ts";
import { joinWaitlistCore, quoteCouponCore } from "./quote.ts";
import { firstChargeDate, submitEnrollmentCore, type EnrollDeps, type RequestInfo } from "./submit.ts";

/*
 * P1 end to end on a real Postgres (PGlite, in process): the migrations in
 * ./drizzle are applied exactly as on Neon, then each route, guard and rule
 * of the enrollment save path is exercised through submitEnrollmentCore.
 * No network: reCAPTCHA, Telegram and Gmail are fakes.
 */

const { registrations, families, familyMembers, reviewReasons, coupons, couponRedemptions, outbox, idempotency, rateLimits, settings, auditLog, waitlist, eligibilityBlocks } =
  schema;

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

const NOW = new Date("2026-11-24T15:00:00Z");
const SECRET = "test-secret-0123456789abcdef0123456789";
const IP = "203.0.113.7";

let submitSeq = 0;
const newSubmitId = () => `submit-${String(++submitSeq).padStart(12, "0")}`;

function draft(variant: Draft["variant"] = "monthly", over: Partial<Draft> = {}): Draft {
  return {
    ...emptyDraft(variant, newSubmitId()),
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
    ...over,
  };
}

const request = (over: Partial<RequestInfo> = {}): RequestInfo => ({
  ip: IP,
  ipCountry: "US",
  host: "dev.ilmulquranus.org",
  fbp: "fb.1.123.456",
  fbc: "",
  consent: "unknown",
  ...over,
});

let eventSeq = 0;
function deps(over: Partial<EnrollDeps> = {}): EnrollDeps {
  return {
    now: NOW,
    mode: "test",
    hashSecret: SECRET,
    verifyCaptcha: async (token) => (token === "bad" ? { ok: false, reason: "low_score" } : { ok: true, score: 0.9 }),
    newEventId: () => `lead_test_${String(++eventSeq).padStart(4, "0")}`,
    adminEmailTo: "team@example.org",
    cardStepLive: false,
    ...over,
  };
}

async function submit(d: Draft, opts: { token?: string; honeypot?: string; req?: Partial<RequestInfo>; deps?: Partial<EnrollDeps> } = {}) {
  return submitEnrollmentCore(db, { rawDraft: d, recaptchaToken: opts.token ?? "ok", honeypot: opts.honeypot ?? "", request: request(opts.req) }, deps(opts.deps));
}

async function setSetting(key: string, value: unknown) {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

const reasonsOf = async (id: number) =>
  (await db.select().from(reviewReasons).where(eq(reviewReasons.registrationId, id))).map((r) => (r.detail ? `${r.reason}:${r.detail}` : r.reason)).sort();

const outboxRows = async () => db.select().from(outbox).orderBy(outbox.id);

function okResult(r: Awaited<ReturnType<typeof submit>>) {
  assert.equal(r.status, "ok", JSON.stringify(r));
  return r as Extract<typeof r, { status: "ok" }>;
}

const idOf = (href: string) => Number(/ref=IQU-(\d+)/.exec(href)?.[1]);

/* ── Routes ──────────────────────────────────────────────────────────── */

test("card route: saved as card pending with a family, money in cents, outbox after routing", async () => {
  const r = okResult(await submit(draft()));
  assert.equal(r.route, "card");
  assert.match(r.href, /^\/enroll\/confirmation\?s=card-next&ref=IQU-1&eid=lead_test_\d{4}&v=48&cn=Free\+Enrollment$/);

  const [reg] = await db.select().from(registrations);
  assert.equal(reg.status, "card_pending");
  assert.equal(reg.program, "monthly");
  assert.equal(reg.perClassCents, 400);
  assert.equal(reg.calculatedCents, 4800);
  assert.equal(reg.discountCents, 0);
  assert.equal(reg.paymentCents, 4800);
  assert.equal(reg.courseVariant, "noorani-qaidah");
  assert.equal(reg.timeZoneLabel, "CT");
  assert.equal(reg.countryIp, "US");
  assert.equal(reg.existingStudent, false);
  assert.equal(reg.userAgent, null);
  assert.equal(reg.fbp, null, "Meta ids only with marketing consent");
  assert.deepEqual(await reasonsOf(reg.id), []);

  const [fam] = await db.select().from(families);
  assert.equal(fam.mode, "test");
  assert.equal(fam.status, "not_sent");
  assert.equal(fam.netCents, 4800);
  assert.equal(fam.firstChargeDate, "2027-01-01"); // K1: signup + 30 days, then the next 1st
  assert.equal(fam.stripeCustomerId, null, "no Stripe in P1");
  assert.equal(reg.familyId, fam.id);
  const [member] = await db.select().from(familyMembers);
  assert.equal(member.amountCents, 4800);

  const rows = await outboxRows();
  assert.deepEqual(rows.map((o) => `${o.kind}:${(o.payload as { template: string }).template}`), [
    "telegram:new_registration",
    "email:admin_new",
    "email:family_card",
    "meta:meta_lead",
  ]);
  const tg = (rows[0].payload as { html: string }).html;
  assert.match(tg, /Route: <b>Card step \(Stripe not connected yet/);
  assert.match(tg, /Status: <b>Card pending<\/b>/);
  assert.match(tg, /Course variant: <b>noorani-qaidah<\/b>/);
  assert.match(tg, /Time Slot: <b>4:00 PM – 6:00 PM \(CT\)/);
  assert.match(tg, /Dhaka time/);
  const family = rows[2].payload as { to: string; subject: string; text: string };
  assert.equal(family.to, "parent@example.com");
  assert.match(family.subject, /^Next: add your card/);
  assert.match(family.text, /We will send you the secure link/); // truthful: no Stripe link exists yet
  assert.match(family.text, /Sahih al-Bukhari 5027/);
  assert.deepEqual(Object.keys(rows[3].payload as object).sort(), ["contentName", "event", "eventId", "registrationId", "template", "valueCents"]);
  assert.equal(r.outboxIds.length, 4);

  const [claim] = await db.select().from(idempotency);
  assert.equal(claim.state, "done");
});

test("review route: an existing student goes to the team, no family, no card", async () => {
  const r = okResult(await submit(draft("monthly", { existing: "yes" })));
  assert.equal(r.route, "review");
  assert.match(r.href, /s=review&ref=IQU-1/);
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.status, "pending_review");
  assert.equal(reg.existingStudent, true);
  assert.deepEqual(await reasonsOf(reg.id), ["existing_student"]);
  assert.equal((await db.select().from(families)).length, 0);
  const family = (await outboxRows()).find((o) => (o.payload as { template: string }).template === "family_review");
  assert.match((family?.payload as { subject: string }).subject, /^We received Ayesha's enrollment/);
});

test("aid route (decisions 2 and 3): a help request is reviewed, never sent to a card", async () => {
  const r = okResult(await submit(draft("monthly", { feeChoice: "help", helpLevel: "full", helpNote: "Two children" })));
  assert.equal(r.route, "aid");
  assert.match(r.href, /s=aid&/);
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.status, "pending_review");
  assert.equal(reg.aidLevel, "full");
  assert.equal(reg.aidNote, "Two children");
  assert.equal(reg.paymentCents, 4800, "the request is not applied: the team agrees the fee");
  assert.deepEqual(await reasonsOf(reg.id), ["aid_request"]);
  assert.equal((await db.select().from(families)).length, 0);
  const tg = (await outboxRows())[0].payload as { html: string };
  assert.match(tg.html, /Help With the Fee Requested/);
});

test("sibling: an email that already has a family goes to review", async () => {
  okResult(await submit(draft()));
  const r = okResult(await submit(draft("monthly", { firstName: "Yusuf" })));
  assert.equal(r.route, "review");
  assert.deepEqual(await reasonsOf(idOf(r.href)), ["sibling"]);
});

test("weekend route: free, pending, timing consent stored", async () => {
  const r = okResult(await submit(draft("weekend", { existing: "yes" })));
  assert.equal(r.route, "weekend");
  assert.match(r.href, /s=weekend&ref=IQU-1&eid=.*cn=Weekend\+Ilm\+Program\+%28Existing%29/);
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.program, "weekend_existing");
  assert.equal(reg.status, "pending");
  assert.equal(reg.paymentStatus, "not_required");
  assert.ok(reg.timingConsentAt);
  assert.equal(reg.paymentCents, null);
});

test("summer_pay route: the fee comes from settings, saved as waiting for Stripe", async () => {
  await setSetting("summer_fee_cents", 4500);
  const r = okResult(await submit(draft("summer")));
  assert.equal(r.route, "summer_pay");
  assert.match(r.href, /s=summer-next&ref=IQU-1&.*v=45&cn=Summer\+Program\+Level\+1/);
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.program, "summer_l1");
  assert.equal(reg.status, "pending");
  assert.equal(reg.paymentStatus, "stripe_pending");
  assert.equal(reg.paymentCents, 4500);
  assert.equal(reg.stripeMode, "test");
  const family = (await outboxRows()).find((o) => (o.payload as { template: string }).template === "family_summer_pay");
  assert.match((family?.payload as { subject: string }).subject, /amount due \$45/);
  assert.doesNotMatch((family?.payload as { text: string }).text, /paid/i);
});

test("summer help and existing student go to review", async () => {
  const help = okResult(await submit(draft("summer", { summerFee: "help", summerHelp: "free" })));
  assert.equal(help.route, "review");
  assert.match(help.href, /s=summer-review/);
  assert.deepEqual(await reasonsOf(idOf(help.href)), ["help"]);
  const existing = okResult(await submit(draft("summer", { summerFee: "existing", firstName: "Yusuf" })));
  assert.match(existing.href, /s=summer-existing/);
  const [reg] = await db.select().from(registrations).where(eq(registrations.id, idOf(existing.href)));
  assert.equal(reg.status, "pending");
  assert.equal(reg.admissionFee, "complimentary");
  assert.deepEqual(await reasonsOf(reg.id), ["existing_student"]);
});

test("payment step off (setting): monthly enrollments are saved for the team, never a card", async () => {
  await setSetting("free_payment_step", "off");
  const r = okResult(await submit(draft()));
  assert.equal(r.route, "review");
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.status, "pending");
  assert.equal((await db.select().from(families)).length, 0);
});

/* ── Idempotency, honeypot, reCAPTCHA ────────────────────────────────── */

test("idempotent resubmit: the first answer again, nothing saved or sent twice", async () => {
  const d = draft();
  const first = okResult(await submit(d));
  const before = (await outboxRows()).length;
  const again = okResult(await submit(d));
  assert.equal(again.repeat, true);
  assert.equal(again.href, first.href, "the same confirmation, so the Pixel is not fired with a new event id");
  assert.deepEqual(again.outboxIds, []);
  assert.equal((await db.select().from(registrations)).length, 1);
  assert.equal((await outboxRows()).length, before);
});

test("a resubmit while the first is still running is told to wait; a dead claim is taken over", async () => {
  const d = draft();
  await db.insert(idempotency).values({ key: d.submitId, state: "running", createdAt: new Date(NOW.getTime() - 10_000), expiresAt: new Date(NOW.getTime() + 60_000) });
  const busy = await submit(d);
  assert.deepEqual(busy, { status: "error", code: "in_progress", message: "Your enrollment is already being saved. Please wait a moment." });
  await db.update(idempotency).set({ createdAt: new Date(NOW.getTime() - 5 * 60_000) }).where(eq(idempotency.key, d.submitId));
  okResult(await submit(d));
});

test("a failed check releases the claim, so the family can fix and resend", async () => {
  const d = draft();
  const refused = await submit(d, { token: "bad" });
  assert.equal(refused.status, "error");
  assert.equal((refused as { code: string }).code, "recaptcha_failed");
  assert.equal((await db.select().from(idempotency)).length, 0);
  okResult(await submit(d));
});

test("honeypot: a quiet generic page, nothing saved, nothing sent", async () => {
  const r = okResult(await submit(draft(), { honeypot: "http://spam.example" }));
  assert.equal(r.href, "/enroll/confirmation?s=review");
  assert.equal((await db.select().from(registrations)).length, 0);
  assert.equal((await outboxRows()).length, 0);
});

test("the server applies the browser's own step rules", async () => {
  const r = await submit(draft("monthly", { classLength: 45 }));
  assert.equal(r.status, "invalid");
  assert.equal((r as { step: string }).step, "schedule");
  assert.equal((await db.select().from(registrations)).length, 0);
});

/* ── Rate limits (HMAC keys only) ────────────────────────────────────── */

test("rate limits: 8 an hour per email hash, 15 per IP hash; counted only on success", async () => {
  for (let i = 0; i < LIMITS.enrollEmail - 1; i++) await bump(db, hashKey(SECRET, "email", "parent@example.com"), NOW);
  okResult(await submit(draft())); // the 8th
  const ninth = await submit(draft("monthly", { firstName: "Yusuf" }));
  assert.equal((ninth as { code: string }).code, "rate_limited");

  for (let i = 0; i < LIMITS.enrollIp; i++) await bump(db, hashKey(SECRET, "ip", "198.51.100.9"), NOW);
  const ip = await submit(draft("monthly", { email: "other@example.com" }), { req: { ip: "198.51.100.9" } });
  assert.equal((ip as { code: string }).code, "rate_limited");
  // The next hour starts a new window.
  okResult(await submit(draft("monthly", { email: "other@example.com" }), { req: { ip: "198.51.100.9" }, deps: { now: new Date(NOW.getTime() + 3_600_000) } }));
});

test("no raw IP or email is stored anywhere; no request without an IP shares one key", async () => {
  okResult(await submit(draft()));
  okResult(await submit(draft("monthly", { email: "b@example.com", firstName: "Bilal" }), { req: { ip: "" } }));
  const keys = (await db.select().from(rateLimits)).map((r) => r.key);
  assert.ok(keys.every((k) => /^[a-z]+:[a-f0-9]{32}$/.test(k)), keys.join(","));
  assert.equal(keys.filter((k) => k.startsWith("ip:")).length, 1, "the request without an IP adds no IP key");
  const dump = JSON.stringify((await client.query(`SELECT * FROM registrations`)).rows) + JSON.stringify((await client.query(`SELECT * FROM rate_limits`)).rows);
  assert.ok(!dump.includes(IP));
  const columns = (await client.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'`)).rows;
  assert.ok(!columns.some((c) => /^(ip|ip_address|client_ip|ip_hash)$/.test(c.column_name)), "no IP column (decision 1); country_ip is a 2-letter country");
});

/* ── Coupons, declaration, Special plan ──────────────────────────────── */

async function coupon(over: Partial<typeof coupons.$inferInsert> = {}) {
  const [row] = await db
    .insert(coupons)
    .values({ code: "QAD-261124-M4P9AB-100", courseKey: "qaidah", discountType: "percent", valuePercent: 100, maxUses: 5, ...over })
    .returning();
  return row;
}

const withCode = (code: string, over: Partial<Draft> = {}) =>
  draft("monthly", { feeChoice: "code", couponCode: code, couponApplied: { code, discount: 0, final: 0, percent: 0, declaration: "x" }, zakatDeclaration: true, ...over });

test("a 100% Zakat code: redeemed in the same transaction, $0 fee, reviewed (help), declaration snapshot", async () => {
  const c = await coupon();
  const r = okResult(await submit(withCode(c.code)));
  assert.equal(r.route, "review");
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.couponId, c.id);
  assert.equal(reg.discountCents, 4800);
  assert.equal(reg.paymentCents, 0);
  assert.equal(reg.zakatDeclaration, true);
  assert.equal(reg.zakatDeclarationText, declarationText(100, 4800));
  assert.match(reg.zakatDeclarationText ?? "", /full \(100%\) scholarship covering \$48\.00/);
  assert.deepEqual(await reasonsOf(reg.id), ["help"]);
  assert.equal((await db.select().from(couponRedemptions)).length, 1);
  assert.match(((await outboxRows())[0].payload as { html: string }).html, /Full Zakat Scholarship/);
});

test("a partial code: reviewed as help (EN:119), percent half-up to the cent", async () => {
  const c = await coupon({ code: "ALL-261124-K9RDXY-30", courseKey: "ALL", valuePercent: 30 });
  const r = okResult(await submit(withCode(c.code)));
  assert.equal(r.route, "review", "any coupon is a help reason");
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.discountCents, 1440);
  assert.equal(reg.paymentCents, 3360);
  assert.match(reg.zakatDeclarationText ?? "", /a 30% scholarship \(\$14\.40 per month\)/);
});

test("a code needs the Zakat declaration", async () => {
  const c = await coupon();
  const r = await submit(withCode(c.code, { zakatDeclaration: false }));
  assert.equal(r.status, "invalid");
  assert.equal((await db.select().from(registrations)).length, 0);
});

test("code refusals use the live messages and count against guessing", async () => {
  await coupon({ code: "HFZ-261124-AAAAAA-50", courseKey: "hifz", valuePercent: 50 });
  await coupon({ code: "QAD-200101-BBBBBB-50", valuePercent: 50, expiresOn: "2026-11-23" });
  await coupon({ code: "QAD-261124-CCCCCC-50", valuePercent: 50, status: "inactive" });
  const used = await coupon({ code: "QAD-261124-DDDDDD-50", valuePercent: 50, maxUses: 1 });
  okResult(await submit(withCode(used.code, { email: "first@example.com" })));

  const msg = async (code: string, email: string) => {
    const r = await submit(withCode(code, { email }));
    assert.equal(r.status, "invalid");
    return (r as { errors: Record<string, string> }).errors.couponCode;
  };
  assert.equal(await msg("HFZ-261124-AAAAAA-50", "a@example.com"), "This coupon is only valid for Quran Hifz. Please select that course or use a different code.");
  assert.equal(await msg("QAD-200101-BBBBBB-50", "b@example.com"), "This coupon code has expired. Please contact us for a new one.");
  assert.equal(await msg("QAD-261124-CCCCCC-50", "c@example.com"), "This coupon code is not valid. Please check the code and try again.");
  assert.equal(await msg("QAD-261124-ZZZZZZ-50", "d@example.com"), "This coupon code is not valid. Please check the code and try again.");
  assert.equal(await msg(used.code, "e@example.com"), "This coupon code has already been used. Please contact us for a new one.");
  assert.equal((await db.select().from(registrations)).length, 1, "a refused code saves nothing");
  assert.equal((await db.select().from(couponRedemptions)).length, 1);
});

test("Special plan: opt-in with 'I can pay' only, never with a code", async () => {
  const special = okResult(await submit(draft("monthly", { special: true })));
  assert.equal(special.route, "card");
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.specialPlan, true);
  assert.equal(reg.discountCents, 800); // $48 → $40 (Qaidah, 3 days)
  assert.equal(reg.paymentCents, 4000);
  assert.match(((await outboxRows())[0].payload as { html: string }).html, /Special Discount/);

  const c = await coupon({ code: "QAD-261124-EEEEEE-50", valuePercent: 50 });
  okResult(await submit(withCode(c.code, { special: true, email: "x@example.com" })));
  const [withCoupon] = await db.select().from(registrations).where(eq(registrations.email, "x@example.com"));
  assert.equal(withCoupon.specialPlan, false);
  assert.equal(withCoupon.couponId, c.id);
});

test("money in cents: Hifz 5 days is 10000; every money column is an integer", async () => {
  okResult(await submit(draft("monthly", { courseId: "quran-hifz", daysPerWeek: 5, days: ["monday", "tuesday", "wednesday", "thursday", "friday"], memorized: "Juz Amma" })));
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.perClassCents, 500);
  assert.equal(reg.calculatedCents, 10000);
  for (const v of [reg.perClassCents, reg.calculatedCents, reg.discountCents, reg.paymentCents]) assert.ok(Number.isInteger(v));
});

test("Apply (coupon quote): plugin messages, 20 tries an hour per IP, 100 failures pause the check and tell the team once", async () => {
  const c = await coupon({ code: "QAD-261124-FFFFFF-45", valuePercent: 45 });
  const input = { code: c.code, courseId: "noorani-qaidah", daysPerWeek: 3, recaptchaToken: "ok", ip: IP, host: "dev.ilmulquranus.org" };
  const quoteDeps = { now: NOW, hashSecret: SECRET, verifyCaptcha: deps().verifyCaptcha };
  const ok = await quoteCouponCore(db, input, quoteDeps);
  assert.deepEqual(ok, {
    status: "ok",
    coupon: { code: c.code, discount: 21.6, final: 26.4, percent: 45, declaration: declarationText(45, 2160) },
    message: "Coupon applied: $21.60 scholarship granted from the Zakat fund.",
  });
  for (let i = 0; i < 19; i++) await bump(db, hashKey(SECRET, "coupon", IP), NOW);
  assert.deepEqual(await quoteCouponCore(db, input, quoteDeps), { status: "error", message: GUARD_MESSAGES.tooMany });

  for (let i = 0; i < LIMITS.couponFailuresSiteWide - 1; i++) await bump(db, hashKey(SECRET, "couponfail", "site"), NOW);
  const wrong = await quoteCouponCore(db, { ...input, ip: "198.51.100.1", code: "QAD-261124-NOPE00-10" }, quoteDeps);
  assert.equal((wrong as { message: string }).message, "This coupon code is not valid. Please check the code and try again.");
  assert.deepEqual(await quoteCouponCore(db, { ...input, ip: "198.51.100.2" }, quoteDeps), { status: "error", message: GUARD_MESSAGES.paused });
  const paused = (await outboxRows()).filter((o) => (o.payload as { template: string }).template === "coupon_paused");
  assert.equal(paused.length, 1);
});

/* ── Eligibility: monitor vs enforce ─────────────────────────────────── */

test("monitor (the live setting): an outside number and residence are saved with location reasons, never blocked", async () => {
  const outside = draft("monthly", { phoneCountry: "OTHER", phone: "+44 20 7946 0958", residence: "GB" });
  const r = okResult(await submit(outside, { req: { ipCountry: "GB" } }));
  assert.equal(r.route, "card", "a location flag does not change the route (plugin EL:231-256 + EN:101-139)");
  const [reg] = await db.select().from(registrations);
  assert.equal(reg.countryIp, "GB");
  assert.deepEqual(await reasonsOf(reg.id), ["location:phone", "location:residence"]);
  // EL:242-243: a would-be block is counted for the 9 PM summary — the country and the hour only.
  const blocks = await db.select().from(eligibilityBlocks);
  assert.deepEqual(blocks.map((b) => [b.mode, b.country, b.count, b.hour.toISOString()]), [["monitor", "GB", 1, "2026-11-24T15:00:00.000Z"]]);
});

test("monitor: a US number abroad is flagged by IP only", async () => {
  const r = okResult(await submit(draft(), { req: { ipCountry: "BD" } }));
  assert.deepEqual(await reasonsOf(idOf(r.href)), ["location:ip"]);
});

test("enforce: a +1 Caribbean area code is blocked and nothing is saved; an IP flag still passes", async () => {
  await setSetting("country_check", "enforce");
  const jamaica = await submit(draft("monthly", { phone: "(876) 555-0123" }));
  assert.equal(jamaica.status, "blocked");
  assert.equal((jamaica as { country: string }).country, "JM");
  assert.equal((await db.select().from(registrations)).length, 0);
  assert.equal((await db.select().from(idempotency)).length, 0);
  const travelling = okResult(await submit(draft(), { req: { ipCountry: "SA" } }));
  assert.deepEqual(await reasonsOf(idOf(travelling.href)), ["location:ip"]);
  // Only the block is counted (as enforce); an IP-only flag is not a block (EL:242).
  const blocks = await db.select().from(eligibilityBlocks);
  assert.deepEqual(blocks.map((b) => [b.mode, b.country, b.count]), [["enforce", "JM", 1]]);
});

test("off: no eligibility check at all", async () => {
  await setSetting("country_check", "off");
  const r = okResult(await submit(draft("monthly", { phoneCountry: "OTHER", phone: "+44 20 7946 0958", residence: "GB" })));
  assert.deepEqual(await reasonsOf(idOf(r.href)), []);
});

/* ── Re-enrollment (RE) ──────────────────────────────────────────────── */

async function existingMonthly(status: string, family: { status: string; sub: string | null }) {
  const [reg] = await db
    .insert(registrations)
    .values({
      program: "monthly",
      status,
      firstName: "Ayesha",
      lastName: "Rahman",
      email: "Parent@Example.com",
      whatsappE164: "+12145550100",
      courseKey: "qaidah",
      courseVariant: "quran-nazirah",
      daysPerWeek: 5,
      paymentCents: 8000,
      calculatedCents: 8000,
      createdVia: "import",
      archivedAt: NOW,
      archivedBy: "admin",
    })
    .returning();
  const [fam] = await db
    .insert(families)
    .values({ mode: "test", contactEmail: "parent@example.com", studentType: "current", status: family.status, stripeSubscriptionId: family.sub, monthlyCents: 8000, netCents: 8000 })
    .returning();
  await db.insert(familyMembers).values({ familyId: fam.id, registrationId: reg.id, mode: "test", amountCents: 8000 });
  await db.update(registrations).set({ familyId: fam.id }).where(eq(registrations.id, reg.id));
  return { reg, fam };
}

test("re-enrollment, active: details only (decision 12), no Lead, no 'New Registration'", async () => {
  const { reg } = await existingMonthly("enrolled", { status: "active", sub: "sub_123" });
  const r = okResult(await submit(draft("monthly", { firstName: " ayesha", lastName: "RAHMAN", phone: "(214) 555-0199" })));
  assert.equal(r.route, "details");
  assert.equal(r.href, `/enroll/confirmation?s=details&ref=IQU-${reg.id}`, "no Lead fields");
  const [after] = await db.select().from(registrations);
  assert.equal(after.id, reg.id);
  assert.equal(after.status, "enrolled");
  assert.equal(after.courseVariant, "quran-nazirah", "course, days and fee unchanged");
  assert.equal(after.paymentCents, 8000);
  assert.equal(after.createdVia, "import");
  assert.equal(after.whatsappE164, "+12145550199", "the family's details are updated");
  assert.ok(after.reenrolledAt);
  assert.equal(after.archivedAt, null, "an archived record is restored");
  assert.deepEqual((await outboxRows()).map((o) => (o.payload as { template: string }).template), ["details_updated", "family_details"]);
});

test("re-enrollment, inactive: the whole submission, existing student, reviewed, taken off the canceled family", async () => {
  const { reg, fam } = await existingMonthly("cancelled", { status: "canceled", sub: "sub_456" });
  const r = okResult(await submit(draft()));
  assert.equal(r.route, "review");
  assert.equal(idOf(r.href), reg.id, "same IQU number");
  const [after] = await db.select().from(registrations);
  assert.equal(after.status, "pending_review");
  assert.equal(after.existingStudent, true, "no second free month");
  assert.equal(after.courseVariant, "noorani-qaidah");
  assert.equal(after.createdVia, "import", "created_via is kept (RE:31)");
  assert.equal(after.familyId, null);
  assert.deepEqual(await reasonsOf(reg.id), ["existing_student"]);
  assert.equal((await db.select().from(familyMembers)).length, 0);
  const [log] = await db.select().from(auditLog);
  assert.equal(log.action, "detached");
  assert.equal(log.familyId, fam.id);
  assert.match(((await outboxRows())[0].payload as { html: string }).html, /Re-enrollment: <b>Existing record updated/);
});

test("re-enrollment matches only the same program, name and email: a sibling is a new record", async () => {
  await existingMonthly("enrolled", { status: "active", sub: "sub_789" });
  const sibling = okResult(await submit(draft("monthly", { firstName: "Maryam" })));
  assert.notEqual(sibling.route, "details");
  assert.equal((await db.select().from(registrations)).length, 2);
});

test("summer re-enrollment: a paid place is details only", async () => {
  const [paid] = await db
    .insert(registrations)
    .values({ program: "summer_l1", status: "paid", paymentStatus: "paid", firstName: "Ayesha", lastName: "Rahman", email: "parent@example.com" })
    .returning();
  const r = okResult(await submit(draft("summer")));
  assert.equal(r.route, "details");
  assert.equal(idOf(r.href), paid.id);
});

/* ── Outbox: dedupe, retry, guards ───────────────────────────────────── */

const TEST_CHAT = "-2001";
const LIVE_CHAT = "-100777";

function tgConfig(over: Partial<TelegramConfig> = {}): TelegramConfig {
  return { token: "123:abc", chatId: TEST_CHAT, production: false, liveChatPattern: `^${LIVE_CHAT}$`, ...over };
}

function fakeFetch(status: number, calls: string[] = []): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    return new Response("{}", { status });
  }) as typeof fetch;
}

const adapters = (over: Partial<Adapters> = {}): Adapters => ({ telegram: tgConfig(), gmail: null, fromName: "Ilm-Ul-Quran USA", fetchImpl: fakeFetch(200), ...over });

test("outbox dedupe: the same key is enqueued once", async () => {
  const row = { kind: "telegram" as const, dedupeKey: "tg:x:1", payload: { template: "t", html: "<b>hi</b>" } };
  assert.equal((await enqueue(db, [row], NOW)).length, 1);
  assert.equal((await enqueue(db, [row], NOW)).length, 0);
  assert.equal((await outboxRows()).length, 1);
});

test("outbox: sent once, body dropped after sending; a second run sends nothing", async () => {
  await enqueue(db, [{ kind: "telegram", dedupeKey: "tg:x:2", payload: { template: "t", html: "<b>hi</b>" } }], NOW);
  const calls: string[] = [];
  assert.equal((await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(200, calls) }), { now: NOW })).sent, 1);
  assert.equal((await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(200, calls) }), { now: NOW })).sent, 0);
  assert.equal(calls.length, 1);
  const [row] = await outboxRows();
  assert.equal(row.status, "sent");
  assert.deepEqual(row.payload, { template: "t", redacted: true });
});

test("outbox retry: 1 min, 5 min, 30 min, then dead after 4 attempts; a 400 is not retried", async () => {
  await enqueue(db, [{ kind: "telegram", dedupeKey: "tg:x:3", payload: { template: "t", html: "x" } }], NOW);
  let at = NOW;
  for (const wait of [60_000, 5 * 60_000, 30 * 60_000]) {
    assert.equal((await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(503) }), { now: at })).retrying, 1);
    const [row] = await outboxRows();
    assert.equal(row.nextAttemptAt.getTime(), at.getTime() + wait);
    assert.equal((await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(503) }), { now: at })).retrying, 0, "not due yet");
    at = new Date(at.getTime() + wait);
  }
  assert.equal((await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(503) }), { now: at })).dead, 1);
  const [dead] = await outboxRows();
  assert.equal(dead.status, "dead");
  assert.equal(dead.attempts, MAX_ATTEMPTS);

  await enqueue(db, [{ kind: "telegram", dedupeKey: "tg:x:4", payload: { template: "t", html: "x" } }], NOW);
  assert.equal((await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(400) }), { now: at })).failed, 1);
});

test("outbox: an idle adapter (env missing) leaves rows waiting; stale rows expire; Meta rows are left for the consent phase", async () => {
  await enqueue(
    db,
    [
      { kind: "email", dedupeKey: "e:1", payload: { template: "t", to: "a@example.com", subject: "s", html: "h", text: "t" } },
      { kind: "meta", dedupeKey: "m:1", payload: { template: "meta_lead", event: "Lead", eventId: "lead_1", registrationId: 1, contentName: "Free Enrollment", valueCents: 0 } },
    ],
    NOW,
  );
  const report = await deliverOutbox(db, adapters({ gmail: null }), { now: NOW });
  assert.equal(report.idle, 1);
  const rows = await outboxRows();
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].attempts, 0);
  assert.match(rows[0].lastError ?? "", /not configured/);
  assert.equal(rows[1].status, "pending", "Meta is enqueued only");
  const later = new Date(NOW.getTime() + 49 * 3_600_000);
  assert.equal((await deliverOutbox(db, adapters({ gmail: null }), { now: later })).dead, 1);
});

test("Telegram guard: outside production only the env test chat, never the live chat pattern, nothing without the pattern", () => {
  assert.equal(telegramChatRefusal(tgConfig(), TEST_CHAT), null);
  assert.match(telegramChatRefusal(tgConfig(), LIVE_CHAT) ?? "", /only send to TELEGRAM_CHAT_ID/);
  assert.match(telegramChatRefusal(tgConfig({ chatId: LIVE_CHAT }), LIVE_CHAT) ?? "", /live team chat/);
  assert.match(telegramChatRefusal(tgConfig({ liveChatPattern: null }), TEST_CHAT) ?? "", /telegram_live_chat_pattern/);
  assert.equal(telegramChatRefusal(tgConfig({ production: true, chatId: LIVE_CHAT }), LIVE_CHAT), null);
  assert.equal(telegramConfig({ TELEGRAM_BOT_TOKEN: "x" } as unknown as NodeJS.ProcessEnv, null), null, "idle without a chat id");
});

test("Telegram guard in the worker: a row for another chat is skipped and never sent", async () => {
  await enqueue(db, [{ kind: "telegram", dedupeKey: "tg:x:5", payload: { template: "t", html: "x", chatId: LIVE_CHAT } }], NOW);
  const calls: string[] = [];
  const report = await deliverOutbox(db, adapters({ fetchImpl: fakeFetch(200, calls) }), { now: NOW });
  assert.equal(report.skipped, 1);
  assert.equal(calls.length, 0);
  const [row] = await outboxRows();
  assert.equal(row.status, "skipped");
  assert.deepEqual(row.payload, { template: "t", redacted: true });
});

test("email guard: outside production only EMAIL_ALLOWLIST receives; others are logged and skipped", async () => {
  resetGmailTokenCache();
  const gmail: GmailConfig = {
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "refresh",
    sender: "team@example.org",
    production: false,
    allowlist: parseAllowlist("Tester@Example.com, team@example.org"),
  };
  await enqueue(
    db,
    [
      { kind: "email", dedupeKey: "e:2", payload: { template: "t", to: "family@example.com", subject: "s", html: "<p>h</p>", text: "h" } },
      { kind: "email", dedupeKey: "e:3", payload: { template: "t", to: "tester@example.com", subject: "Assalamu alaikum — test", html: "<p>h</p>", text: "h" } },
    ],
    NOW,
  );
  const calls: string[] = [];
  const report = await deliverOutbox(db, adapters({ gmail, fetchImpl: fakeFetch(200, calls) }), { now: NOW });
  assert.deepEqual([report.skipped, report.sent], [1, 1]);
  assert.deepEqual(calls, ["https://oauth2.googleapis.com/token", "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"]);
  const rows = await outboxRows();
  assert.equal(rows[0].status, "skipped");
  assert.match(rows[0].lastError ?? "", /EMAIL_ALLOWLIST/);
  assert.equal(rows[1].status, "sent");
});

test("a whole enrollment on staging: family email skipped (not on the allow-list), team email and test-chat Telegram sent", async () => {
  resetGmailTokenCache();
  const r = okResult(await submit(draft()));
  const gmail: GmailConfig = { clientId: "id", clientSecret: "s", refreshToken: "r", sender: "team@example.org", production: false, allowlist: parseAllowlist("team@example.org") };
  const report = await deliverOutbox(db, adapters({ gmail }), { now: NOW, ids: r.outboxIds });
  assert.deepEqual([report.sent, report.skipped], [2, 1]);
  const meta = await db.select().from(outbox).where(and(eq(outbox.kind, "meta"), eq(outbox.status, "pending")));
  assert.equal(meta.length, 1);
});

/* ── Waitlist ────────────────────────────────────────────────────────── */

test("waitlist: saved once per email and program, 5 an hour per IP", async () => {
  const input = { email: "Far@Example.com", name: "Amina", program: "monthly" as const, country: "GB", recaptchaToken: "ok", ip: IP, host: "dev.ilmulquranus.org" };
  const quoteDeps = { now: NOW, hashSecret: SECRET, verifyCaptcha: deps().verifyCaptcha };
  assert.equal((await joinWaitlistCore(db, input, quoteDeps)).status, "ok");
  assert.equal((await joinWaitlistCore(db, { ...input, email: "far@example.com" }, quoteDeps)).status, "ok");
  assert.equal((await db.select().from(waitlist)).length, 1);
  for (let i = 0; i < 3; i++) await joinWaitlistCore(db, { ...input, email: `w${i}@example.com` }, quoteDeps);
  assert.equal((await joinWaitlistCore(db, { ...input, email: "late@example.com" }, quoteDeps)).status, "error");
});

/* ── Helpers ─────────────────────────────────────────────────────────── */

test("K1 first charge date: the first 1st on or after signup + 30 days", () => {
  assert.equal(firstChargeDate(new Date("2026-11-24T15:00:00Z")), "2027-01-01");
  assert.equal(firstChargeDate(new Date("2026-12-02T00:00:00Z")), "2027-01-01");
  assert.equal(firstChargeDate(new Date("2026-01-30T12:00:00Z")), "2026-03-01");
});
