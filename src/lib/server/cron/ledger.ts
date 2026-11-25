import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { isPriceKey, monthlyFeeForKey } from "../../../content/pricing.ts";
import { auditLog, discountLedger, families, familyMembers, registrations } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";
import { toCents } from "../../money.ts";
import { addDaysYmd, previousMonth, siteMonth, siteMonthStart, siteYmd } from "../dhaka.ts";
import type { StripeMode } from "../stripe-mode.ts";

/*
 * Zakat and Special Discount ledger: the daily job (IQU_Discount_Ledger,
 * includes/class-iqu-discount-ledger.php, plugin 3.7.20, read 25 Nov 2026).
 * Ported rule for rule; the line numbers below are that file (DL), the
 * pricing (BP = includes/billing/class-iqu-billing-pricing.php), the billing
 * service (BS = includes/billing/class-iqu-billing-service.php) and the
 * database class (DB = includes/class-iqu-database.php).
 *
 * One row per student × month × fund, written for the CURRENT site month
 * (Asia/Dhaka) of every active student with a reduction. Re-running the same
 * day is harmless: the current month's row has its amount and reason replaced
 * (DL:294-306), never a second row (unique month + student + fund). Past months
 * are never touched, so a later fee change cannot alter them.
 *
 *   ZAKAT   = a coupon (DL:141)
 *   SPECIAL = the Special plan (DL:142)
 *   an agreed fee, or an admin discount (no coupon, no special plan, no agreed
 *   fee), counts under the fund an admin chose; no fund = counted nowhere (DL:137-144).
 *   The free first month of a new student counts as neither (DL:275).
 *
 * Money is in cents; the plugin's DECIMAL(8,2) dollars round the same way.
 */

export type Reg = typeof registrations.$inferSelect;
export type LedgerItem = { kind: "zakat" | "special"; reason: "coupon" | "special_plan" | "agreed_fee" | "admin_discount"; amountCents: number };

export type BillingPrice = {
  billable: boolean;
  scholarship: boolean;
  needsInput: boolean;
  grossCents: number;
  discountCents: number;
  netCents: number;
  standardCents?: number;
  agreedCents?: number;
  legacy?: boolean;
};

const FUNDS = ["zakat", "special"] as const;
const ACTIVE_PROGRAMS = ["monthly", "weekend_existing", "weekend_new"] as const; // DB:515
const ACTIVE_STATUS = "enrolled"; // DB:516
const FREE_MONTH_DAYS = 30; // BS:27

/** BP:235-249: the fee chosen on the older form (fee_pref "hifz_100" / "custom_25", else the old payment). */
function legacyFee(reg: Reg): { key: string; cents: number; custom: boolean } | null {
  const pref = (reg.legacyFeePref ?? "").trim().toLowerCase();
  const m = /^([a-z]+)_(\d+(?:\.\d{1,2})?)$/.exec(pref);
  if (m) {
    const key = isPriceKey(m[1]) ? m[1] : "";
    if (key || m[1] === "custom") return { key, cents: toCents(m[2]), custom: m[1] === "custom" };
  }
  const paid = reg.paymentCents ?? 0;
  return paid > 0 ? { key: "", cents: paid, custom: false } : null;
}

/** BP:104-229 (and from_legacy BP:252-290): the monthly price of a registration as billed. */
export function billingPrice(reg: Reg): BillingPrice {
  const none: BillingPrice = { billable: false, scholarship: false, needsInput: false, grossCents: 0, discountCents: 0, netCents: 0 };
  if (reg.program !== "monthly") return none; // BP:124-127

  const recKey = reg.courseKey ?? "";
  const agreed = reg.agreedFeeCents; // BP:80-84: null = none agreed

  if (recKey === "") {
    const legacy = legacyFee(reg);
    if (legacy) {
      // BP:252-290
      let gross = legacy.cents;
      let discount = 0;
      const out: BillingPrice = { ...none, legacy: true, grossCents: gross, netCents: gross };
      if (agreed !== null) {
        out.standardCents = legacy.cents;
        out.agreedCents = agreed;
        if (agreed <= legacy.cents) discount = legacy.cents - agreed;
        else gross = agreed;
      }
      const net = gross - discount;
      Object.assign(out, { grossCents: gross, discountCents: discount, netCents: net });
      if (net <= 0) return { ...out, scholarship: true };
      return { ...out, billable: true };
    }
  }

  // BP:141-157: a valid key and days from the record, else the record needs a course.
  const key = isPriceKey(recKey) ? recKey : "";
  if (!key) return { ...none, needsInput: true };
  const days = reg.daysPerWeek ?? 0;
  const fee = monthlyFeeForKey(key, days);
  if (fee === null) return { ...none, needsInput: true };

  let gross = toCents(fee);
  // BP:162-167: the record's discount, capped at the gross (always priced from the record here).
  let discount = Math.min(gross, Math.max(0, reg.discountCents));
  const out: BillingPrice = { ...none };
  if (agreed !== null) {
    // BP:195-207: an agreed fee is billed exactly; lower = the difference is the reduction.
    out.standardCents = gross;
    out.agreedCents = agreed;
    if (agreed <= gross) discount = gross - agreed;
    else {
      gross = agreed;
      discount = 0;
    }
  }
  const net = gross - discount;
  Object.assign(out, { grossCents: gross, discountCents: discount, netCents: net });
  if (net <= 0) return { ...out, scholarship: true }; // BP:221-225: the discount stays on the result
  return { ...out, billable: true };
}

const fundOf = (reg: Reg) => (FUNDS as readonly string[]).includes(reg.agreedFeeFund ?? "") ? (reg.agreedFeeFund as "zakat" | "special") : null;

/** DL:130-145: what a student's month counts as, or null. */
export function ledgerItem(reg: Reg): LedgerItem | null {
  if (reg.program !== "monthly") return null;
  const discount = billingPrice(reg).discountCents;
  if (discount <= 0) return null;
  const fund = fundOf(reg);
  if (reg.agreedFeeCents !== null) return fund ? { kind: fund, reason: "agreed_fee", amountCents: discount } : null;
  if (reg.couponId !== null && reg.couponId > 0) return { kind: "zakat", reason: "coupon", amountCents: discount }; // DL:147-150
  if (reg.specialPlan) return { kind: "special", reason: "special_plan", amountCents: discount };
  return fund ? { kind: fund, reason: "admin_discount", amountCents: discount } : null;
}

/** BS:124-131: a website enrollment of a student who is not already ours gets the free first month. */
export function freeMonthEligible(reg: Reg): boolean {
  return reg.createdVia === "public" && reg.existingStudent !== true;
}

/** BS:159-164: the day the free month ends (site calendar), or null. */
export function freeMonthEnd(reg: Reg): string | null {
  if (!freeMonthEligible(reg)) return null;
  return siteYmd(new Date(reg.createdAt.getTime() + FREE_MONTH_DAYS * 86_400_000));
}

/** BS:193-202: the first date on or after `ymd` whose day of the month is `day` (1–28). */
export function billingDayOnOrAfter(ymd: string, day: number): string {
  const d = Math.max(1, Math.min(28, day));
  const same = `${ymd.slice(0, 8)}${String(d).padStart(2, "0")}`;
  if (same >= ymd) return same;
  const next = addDaysYmd(`${ymd.slice(0, 8)}01`, 32).slice(0, 8);
  return `${next}${String(d).padStart(2, "0")}`;
}

export type BillingLink = { memberFirstCharge: string | null; familyFirstCharge: string | null } | null;

/** BS:526-541: the first charge the ledger counts from, for a student with a free month. */
export function ledgerFirstCharge(reg: Reg, link: BillingLink, billingDay: number): string | null {
  const end = freeMonthEnd(reg);
  if (end === null) return null;
  if (link) {
    if (link.memberFirstCharge) return link.memberFirstCharge;
    const fam = link.familyFirstCharge ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(fam)) {
      const onOrAfter = billingDayOnOrAfter(end, Number(fam.slice(8, 10)));
      return fam > onOrAfter ? fam : onOrAfter;
    }
  }
  return billingDayOnOrAfter(end, billingDay);
}

/** DL:186-192: the first month that counts (Y-m-01). */
export function firstMonth(reg: Reg, link: BillingLink, billingDay: number): string {
  const charge = ledgerFirstCharge(reg, link, billingDay);
  return charge ? `${charge.slice(0, 7)}-01` : siteMonth(reg.createdAt);
}

/** DB:522-528: an enrolled monthly or Weekend student, not archived, whose billing has not ended before this site month. */
export function isActiveStudent(reg: Reg, now: Date): boolean {
  if (!(ACTIVE_PROGRAMS as readonly string[]).includes(reg.program) || reg.status !== ACTIVE_STATUS) return false;
  if (reg.archivedAt) return false;
  return reg.billingEndedAt === null || reg.billingEndedAt.getTime() >= siteMonthStart(now).getTime();
}

export type Removal = { stripeRef: string | null } | null;

/** DL:222-232: removed from a shared billing record — the last month the ledger counts. */
export function removalLastMonth(reg: Reg, removal: Removal): string | null {
  if (!reg.billingEndedAt || !removal) return null;
  const m = siteMonth(reg.billingEndedAt);
  return removal.stripeRef ? previousMonth(m) : m;
}

export type LedgerCandidate = { reg: Reg; link: BillingLink; removal: Removal };

/** DL:267-281: what counts in `month` — [registration id, item] of every active student past the free month. */
export function currentItems(candidates: LedgerCandidate[], month: string, now: Date, billingDay: number): [number, LedgerItem][] {
  const out: [number, LedgerItem][] = [];
  for (const { reg, link, removal } of [...candidates].sort((a, b) => a.reg.id - b.reg.id)) {
    if (reg.program !== "monthly" || !isActiveStudent(reg, now)) continue;
    const item = ledgerItem(reg);
    if (!item || firstMonth(reg, link, billingDay) > month) continue;
    if (reg.billingEndedAt) {
      const last = removalLastMonth(reg, removal);
      if (last !== null && month > last) continue;
    }
    out.push([reg.id, item]);
  }
  return out;
}

/** The monthly students the job looks at (DB:531-538, active_student_sql), with their billing link and last removal. */
export async function loadCandidates(db: Queryable, now: Date, mode: StripeMode): Promise<LedgerCandidate[]> {
  const regs = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.program, "monthly"),
        eq(registrations.status, ACTIVE_STATUS),
        isNull(registrations.archivedAt),
        or(isNull(registrations.billingEndedAt), gte(registrations.billingEndedAt, siteMonthStart(now))),
      ),
    )
    .orderBy(registrations.id);
  if (!regs.length) return [];
  const ids = regs.map((r) => r.id);

  // IQU_Billing_DB::account_for_registration + get_members (BS:530-538), in the site's Stripe mode.
  const links = await db
    .select({ registrationId: familyMembers.registrationId, member: familyMembers.firstChargeDate, family: families.firstChargeDate })
    .from(familyMembers)
    .innerJoin(families, and(eq(families.id, familyMembers.familyId), eq(families.mode, mode)))
    .where(and(inArray(familyMembers.registrationId, ids), eq(familyMembers.mode, mode)));
  const linkOf = new Map(links.map((l) => [l.registrationId, { memberFirstCharge: l.member, familyFirstCharge: l.family }]));

  // IQU_Billing_DB::removal_for_registration (billing-db.php:443-449): the newest "remove_student" action.
  const removals = await db
    .select({ registrationId: auditLog.registrationId, stripeRef: auditLog.stripeRef })
    .from(auditLog)
    .where(and(eq(auditLog.action, "remove_student"), inArray(auditLog.registrationId, ids)))
    .orderBy(desc(auditLog.id));
  const removalOf = new Map<number, Removal>();
  for (const r of removals) if (r.registrationId !== null && !removalOf.has(r.registrationId)) removalOf.set(r.registrationId, { stripeRef: r.stripeRef });

  return regs.map((reg) => ({ reg, link: linkOf.get(reg.id) ?? null, removal: removalOf.get(reg.id) ?? null }));
}

export type LedgerReport = { month: string; counted: number; inserted: number; updated: number };

/** DL:257-264 run_monthly + DL:294-306 upsert('monthly'). Safe to run any number of times. */
export async function runLedger(db: Queryable, now: Date, opts: { mode: StripeMode; billingDay: number }): Promise<LedgerReport> {
  const month = siteMonth(now);
  const items = currentItems(await loadCandidates(db, now, opts.mode), month, now, opts.billingDay);
  let inserted = 0;
  let updated = 0;
  for (const [registrationId, item] of items) {
    const at = and(eq(discountLedger.month, month), eq(discountLedger.registrationId, registrationId), eq(discountLedger.kind, item.kind));
    // 'monthly' replaces the amount and reason of this month's row (DL:298-301)…
    const changed = await db
      .update(discountLedger)
      .set({ amountCents: item.amountCents, reason: item.reason, source: "monthly" })
      .where(at)
      .returning({ id: discountLedger.id });
    if (changed.length) {
      updated++;
      continue;
    }
    // …else adds it; a row written meanwhile by another run is kept (INSERT IGNORE, DL:303-306).
    const added = await db
      .insert(discountLedger)
      .values({ month, registrationId, kind: item.kind, reason: item.reason, amountCents: item.amountCents, source: "monthly", createdAt: now })
      .onConflictDoNothing()
      .returning({ id: discountLedger.id });
    inserted += added.length;
  }
  return { month, counted: items.length, inserted, updated };
}
