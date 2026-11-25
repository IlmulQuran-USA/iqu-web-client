import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  arrears,
  auditLog,
  couponRedemptions,
  coupons,
  discountLedger,
  FAMILY_STATUSES,
  families,
  familyMembers,
  LEDGER_REASONS,
  payments,
  PROGRAMS,
  QURAN_LEVELS,
  REGISTRATION_STATUSES,
  REVIEW_REASONS,
  registrations,
  reviewReasons,
  stripeEvents,
  waitlist,
  wpImportRows,
} from "../../../db/schema.ts";
import type { AnyDb, AnyTx } from "../../../db/types.ts";
import { checkShape, SOURCE_TABLES, type Row, type Snapshot, type SourceTable } from "./snapshot.ts";
import { cents, centsOrNull, country, e164, flag, idOrNull, int, list, orNull, text, utc, ymd } from "./values.ts";

/*
 * WordPress → Next.js migration (architecture §5.2, Resolved facts; P0 parity).
 *
 * Reads one snapshot from tooling/wp-export.php and writes it into the new
 * schema in ONE transaction. Rules:
 *
 * - Ids: registrations keep their IQU numbers, families keep the plugin's
 *   iqu_account_id (so Stripe metadata iqu_account_id still finds them), and
 *   coupons keep theirs. Every other table matches on its natural key.
 * - Provenance: every written row is recorded in wp_import_rows. A re-run
 *   rewrites only rows recorded there (and only when the source changed); a
 *   target already taken by a row the new system made is a mismatch, never
 *   overwritten. Sequences are then set above the highest id.
 * - Ledger: copied as is (source "wp_import"), never recalculated.
 * - Stripe: linked only by the ids the plugin stored (customer, subscription,
 *   item, invoice, session) and the preserved family ids. No Stripe call.
 * - Mode guard: live Stripe ids are imported only where NEXT_PUBLIC_SITE_ENV is
 *   "production". Anywhere else they are STRIPPED (see `strip`), so a staging
 *   rehearsal reconciles every count and total without a live id leaving production.
 * - Dry run: the same writes inside the transaction, the reconcile report read
 *   back from the database, then a rollback. A write run with any mismatch is
 *   rolled back too ("fails loudly").
 */

export type ImportOptions = {
  dryRun: boolean;
  /** NEXT_PUBLIC_SITE_ENV of the target. Only "production" keeps live Stripe ids. */
  siteEnv: string | undefined;
  /** Accept rows the importer had to skip (each is listed with its reason). Off: any skip fails the run. */
  allowSkips?: boolean;
  now?: Date;
};

export type TableCount = { table: SourceTable | string; source: number; inserted: number; updated: number; unchanged: number; skipped: { key: string; reason: string }[] };
export type MoneyCheck = { name: string; source: number; snapshot: number; target: number; ok: boolean };
export type ImportReport = {
  ok: boolean;
  dryRun: boolean;
  stripe: { mode: "as-is" | "stripped"; liveIdsInSnapshot: number; familiesWithSubscription: number; familiesLinkedByCustomer: number; membersWithItem: number };
  snapshot: { exportedAt: string; pluginVersion: string; site: string };
  tables: TableCount[];
  money: MoneyCheck[];
  sequences: Record<string, number>;
  warnings: string[];
  mismatches: string[];
};

class Rollback extends Error {}

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const wpUser = (v: Row[string]) => (int(v) > 0 ? `wp:${int(v)}` : null);
const STRIPE_ID = /\b(cus|sub|si|in|cs|pi|ch|re|evt|price|prod|ii|seti|pm)_(live_)?[A-Za-z0-9]+/;

/** Live Stripe ids in the snapshot: any Stripe id on a live-mode row, and any `*_live_*` id. */
export function liveStripeIds(snap: Snapshot): number {
  let n = 0;
  for (const t of SOURCE_TABLES) {
    for (const row of snap.tables[t]?.rows ?? []) {
      const live = text(row.mode) === "live";
      for (const [col, v] of Object.entries(row)) {
        const s = text(v);
        if (!s || col === "mode") continue;
        if (/_live_/.test(s) && STRIPE_ID.test(s)) n++;
        else if (live && /^(stripe_|checkout_session|old_invoice|item_id|charged_invoice|stripe_ref)/.test(col) && STRIPE_ID.test(s)) n++;
      }
    }
  }
  return n;
}

export async function importSnapshot(db: AnyDb, snap: Snapshot, opts: ImportOptions): Promise<ImportReport> {
  const now = opts.now ?? new Date();
  const production = opts.siteEnv === "production";
  const liveIds = liveStripeIds(snap);
  const strip = !production && liveIds > 0;
  const report: ImportReport = {
    ok: false,
    dryRun: opts.dryRun,
    stripe: { mode: strip ? "stripped" : "as-is", liveIdsInSnapshot: liveIds, familiesWithSubscription: 0, familiesLinkedByCustomer: 0, membersWithItem: 0 },
    snapshot: { exportedAt: snap.exported_at, pluginVersion: snap.plugin_version, site: snap.site },
    tables: [],
    money: [],
    sequences: {},
    warnings: [],
    mismatches: [],
  };
  const shape = checkShape(snap);
  if (shape.length) {
    report.mismatches.push(...shape);
    return report;
  }
  if (strip) {
    report.warnings.push(
      `Staging target (NEXT_PUBLIC_SITE_ENV=${opts.siteEnv ?? "unset"}): ${liveIds} live Stripe ids were stripped. Live rows keep mode "live", so staging's test-mode jobs never touch them; customer, subscription, item, session and link-token values are emptied, and invoice and event ids are replaced by marked placeholders (in_stripped…, evt_stripped…) so every count and total still reconciles.`,
    );
  }

  try {
    await db.transaction(async (tx) => {
      await run(tx, snap, { strip, now }, report);
      reconcileMoney(snap, report, await targetSums(tx));
      for (const t of report.tables) {
        if (t.skipped.length && !opts.allowSkips) report.mismatches.push(`${t.table}: ${t.skipped.length} row(s) skipped (run with --allow-skips after reviewing them).`);
      }
      report.ok = report.mismatches.length === 0;
      await setSequences(tx, report, !opts.dryRun && report.ok);
      if (opts.dryRun || !report.ok) throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      report.ok = false;
      report.mismatches.push(`Import stopped: ${(error as Error).message}`);
    }
  }
  return report;
}

/* ── One row: provenance-checked upsert ─────────────────────────────── */

type Ctx = { strip: boolean; now: Date };
type Upsert = {
  sourceTable: string;
  sourceKey: string;
  targetTable: string;
  source: unknown;
  /** The target key a fresh insert must use (preserved id), or the natural key's existing row, if any. */
  existing: () => Promise<string | null>;
  insert: () => Promise<string>;
  update: (targetKey: string) => Promise<boolean>;
};

async function upsert(tx: AnyTx, u: Upsert, count: TableCount): Promise<string | null> {
  const h = hash(u.source);
  const [prov] = await tx
    .select()
    .from(wpImportRows)
    .where(and(eq(wpImportRows.sourceTable, u.sourceTable), eq(wpImportRows.sourceKey, u.sourceKey)));
  if (prov) {
    if (prov.sourceHash === h) {
      count.unchanged++;
      return prov.targetKey;
    }
    if (!(await u.update(prov.targetKey))) {
      count.skipped.push({ key: u.sourceKey, reason: `imported before as ${prov.targetTable} ${prov.targetKey}, but that row is gone` });
      return null;
    }
    await tx.update(wpImportRows).set({ sourceHash: h, updatedAt: new Date() }).where(and(eq(wpImportRows.sourceTable, u.sourceTable), eq(wpImportRows.sourceKey, u.sourceKey)));
    count.updated++;
    return prov.targetKey;
  }
  const taken = await u.existing();
  if (taken !== null) {
    count.skipped.push({ key: u.sourceKey, reason: `${u.targetTable} ${taken} already exists and was not imported from WordPress (never overwritten)` });
    return null;
  }
  const key = await u.insert();
  await tx.insert(wpImportRows).values({ sourceTable: u.sourceTable, sourceKey: u.sourceKey, targetTable: u.targetTable, targetKey: key, sourceHash: h });
  count.inserted++;
  return key;
}

const counter = (table: string, source: number): TableCount => ({ table, source, inserted: 0, updated: 0, unchanged: 0, skipped: [] });

/* ── The tables, in foreign-key order ───────────────────────────────── */

async function run(tx: AnyTx, snap: Snapshot, ctx: Ctx, report: ImportReport): Promise<void> {
  const rows = (t: SourceTable) => snap.tables[t].rows as Row[];
  const warn = (m: string) => report.warnings.push(m);
  const imported = { coupons: new Map<number, number>(), families: new Map<number, number>(), registrations: new Set<number>() };
  const familyMode = new Map<number, string>();
  const codeToCoupon = new Map<string, number>();

  // Coupons (preserved ids) ─────────────────────────────────────────
  {
    const c = counter("iqu_coupons", rows("iqu_coupons").length);
    for (const r of rows("iqu_coupons")) {
      const id = int(r.id);
      const v = mapCoupon(r);
      if ("error" in v) {
        c.skipped.push({ key: String(id), reason: v.error });
        continue;
      }
      const key = await upsert(
        tx,
        {
          sourceTable: "iqu_coupons",
          sourceKey: String(id),
          targetTable: "coupons",
          source: r,
          existing: async () => ((await tx.select({ id: coupons.id }).from(coupons).where(eq(coupons.id, id))).length ? String(id) : null),
          insert: async () => String((await tx.insert(coupons).values({ id, ...v }).returning({ id: coupons.id }))[0].id),
          update: async (k) => (await tx.update(coupons).set(v).where(eq(coupons.id, Number(k))).returning({ id: coupons.id })).length > 0,
        },
        c,
      );
      if (key) {
        imported.coupons.set(id, Number(key));
        codeToCoupon.set(v.code, Number(key));
      }
    }
    report.tables.push(c);
  }

  // Families ← iqu_billing_accounts (preserved ids = iqu_account_id) ─
  {
    const c = counter("iqu_billing_accounts", rows("iqu_billing_accounts").length);
    for (const r of rows("iqu_billing_accounts")) {
      const id = int(r.id);
      const v = mapFamily(r, ctx);
      if ("error" in v) {
        c.skipped.push({ key: String(id), reason: v.error });
        continue;
      }
      const key = await upsert(
        tx,
        {
          sourceTable: "iqu_billing_accounts",
          sourceKey: String(id),
          targetTable: "families",
          source: { r, strip: ctx.strip },
          existing: async () => ((await tx.select({ id: families.id }).from(families).where(eq(families.id, id))).length ? String(id) : null),
          insert: async () => String((await tx.insert(families).values({ id, ...v }).returning({ id: families.id }))[0].id),
          update: async (k) => (await tx.update(families).set(v).where(eq(families.id, Number(k))).returning({ id: families.id })).length > 0,
        },
        c,
      );
      if (key) {
        imported.families.set(id, Number(key));
        familyMode.set(id, v.mode);
        if (v.stripeSubscriptionId) report.stripe.familiesWithSubscription++;
        else if (v.stripeCustomerId) report.stripe.familiesLinkedByCustomer++;
      }
    }
    report.tables.push(c);
  }

  // Registrations (preserved ids = IQU numbers) ──────────────────────
  const regById = new Map<number, Row>();
  {
    const c = counter("iqu_registrations", rows("iqu_registrations").length);
    for (const r of rows("iqu_registrations")) {
      const id = int(r.id);
      regById.set(id, r);
      const v = mapRegistration(r, ctx, { coupons: imported.coupons, codeToCoupon, families: imported.families }, (m) => warn(`registration ${id}: ${m}`));
      if ("error" in v) {
        c.skipped.push({ key: String(id), reason: v.error });
        continue;
      }
      const key = await upsert(
        tx,
        {
          sourceTable: "iqu_registrations",
          sourceKey: String(id),
          targetTable: "registrations",
          source: { r, strip: ctx.strip },
          existing: async () => ((await tx.select({ id: registrations.id }).from(registrations).where(eq(registrations.id, id))).length ? String(id) : null),
          insert: async () => String((await tx.insert(registrations).values({ id, ...v }).returning({ id: registrations.id }))[0].id),
          update: async (k) => (await tx.update(registrations).set(v).where(eq(registrations.id, Number(k))).returning({ id: registrations.id })).length > 0,
        },
        c,
      );
      if (key) imported.registrations.add(id);
    }
    report.tables.push(c);
  }

  // Coupon redemptions (rebuilt from the registrations that carry a coupon) and review reasons.
  {
    const red = counter("iqu_registrations.coupon → coupon_redemptions", 0);
    const rev = counter("iqu_registrations.review_reason → review_reasons", 0);
    for (const id of imported.registrations) {
      const r = regById.get(id)!;
      const [reg] = await tx.select({ couponId: registrations.couponId, createdAt: registrations.createdAt, status: registrations.status }).from(registrations).where(eq(registrations.id, id));
      if (reg.couponId) {
        red.source++;
        await upsert(
          tx,
          {
            sourceTable: "iqu_registrations.coupon",
            sourceKey: String(id),
            targetTable: "coupon_redemptions",
            source: { coupon: reg.couponId },
            existing: async () =>
              (await tx.select().from(couponRedemptions).where(and(eq(couponRedemptions.couponId, reg.couponId!), eq(couponRedemptions.registrationId, id)))).length
                ? `${reg.couponId}:${id}`
                : null,
            insert: async () => {
              await tx.insert(couponRedemptions).values({ couponId: reg.couponId!, registrationId: id, redeemedAt: reg.createdAt });
              return `${reg.couponId}:${id}`;
            },
            update: async () => true,
          },
          red,
        );
      }
      for (const reason of list(r.review_reason)) {
        rev.source++;
        if (!(REVIEW_REASONS as readonly string[]).includes(reason)) {
          rev.skipped.push({ key: `${id}:${reason}`, reason: `review reason "${reason}" is not a known reason` });
          continue;
        }
        const open = reg.status === "pending_review";
        await upsert(
          tx,
          {
            sourceTable: "iqu_registrations.review_reason",
            sourceKey: `${id}:${reason}`,
            targetTable: "review_reasons",
            source: { reason, open },
            existing: async () => null,
            insert: async () =>
              String(
                (
                  await tx
                    .insert(reviewReasons)
                    .values({
                      registrationId: id,
                      reason,
                      openedAt: reg.createdAt,
                      // The plugin never cleared a reason (A10): still open only while the registration waits for review.
                      ...(open ? {} : { resolvedAt: utc(r.updated_at) ?? reg.createdAt, resolvedBy: "wp:import", resolutionNote: `Imported from WordPress; the registration was "${reg.status}".` }),
                    })
                    .returning({ id: reviewReasons.id })
                )[0].id,
              ),
            update: async () => true,
          },
          rev,
        );
      }
    }
    report.tables.push(red, rev);
  }

  // Family members ← iqu_billing_members (natural key: mode + registration) ─
  {
    const c = counter("iqu_billing_members", rows("iqu_billing_members").length);
    for (const r of rows("iqu_billing_members")) {
      const famId = imported.families.get(int(r.account_id));
      const regId = int(r.registration_id);
      if (!famId) {
        c.skipped.push({ key: text(r.id), reason: `its family (account ${int(r.account_id)}) was not imported` });
        continue;
      }
      if (!imported.registrations.has(regId)) {
        c.skipped.push({ key: text(r.id), reason: `its registration ${regId} was not imported` });
        continue;
      }
      const mode = text(r.mode) === "live" ? "live" : "test";
      const item = orNull(r.stripe_item_id);
      const v = {
        familyId: famId,
        registrationId: regId,
        mode,
        amountCents: cents(r.amount),
        stripeItemId: ctx.strip && mode === "live" ? null : item,
        firstChargeDate: ymd(r.first_charge_date),
        deferred: false,
        createdAt: utc(r.created_at) ?? ctx.now,
      };
      if (v.stripeItemId) report.stripe.membersWithItem++;
      const regFamily = idOrNull(regById.get(regId)?.billing_account_id);
      if (regFamily !== null && regFamily !== int(r.account_id)) {
        warn(`member ${text(r.id)}: registration ${regId} points to account ${regFamily} but the member row to account ${int(r.account_id)} (plugin data kept as is).`);
      }
      await upsert(
        tx,
        {
          sourceTable: "iqu_billing_members",
          sourceKey: text(r.id),
          targetTable: "family_members",
          source: { r, strip: ctx.strip },
          existing: async () => {
            const [m] = await tx.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.mode, mode), eq(familyMembers.registrationId, regId)));
            return m ? String(m.id) : null;
          },
          insert: async () => String((await tx.insert(familyMembers).values(v).returning({ id: familyMembers.id }))[0].id),
          update: async (k) => (await tx.update(familyMembers).set(v).where(eq(familyMembers.id, Number(k))).returning({ id: familyMembers.id })).length > 0,
        },
        c,
      );
    }
    report.tables.push(c);
  }

  // Payments ← iqu_billing_payments (natural key: Stripe invoice id) ─
  {
    const c = counter("iqu_billing_payments", rows("iqu_billing_payments").length);
    for (const r of rows("iqu_billing_payments")) {
      const famId = imported.families.get(int(r.account_id));
      if (!famId) {
        c.skipped.push({ key: text(r.id), reason: `its family (account ${int(r.account_id)}) was not imported` });
        continue;
      }
      const v = mapPayment(r, famId, ctx, (m) => warn(`payment ${text(r.id)}: ${m}`));
      if ("error" in v) {
        c.skipped.push({ key: text(r.id), reason: v.error });
        continue;
      }
      await upsert(
        tx,
        {
          sourceTable: "iqu_billing_payments",
          sourceKey: text(r.id),
          targetTable: "payments",
          source: { r, strip: ctx.strip },
          existing: async () => {
            const [p] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.stripeInvoiceId, v.stripeInvoiceId));
            return p ? String(p.id) : null;
          },
          insert: async () => String((await tx.insert(payments).values(v).returning({ id: payments.id }))[0].id),
          update: async (k) => (await tx.update(payments).set(v).where(eq(payments.id, Number(k))).returning({ id: payments.id })).length > 0,
        },
        c,
      );
    }
    report.tables.push(c);
  }

  // Arrears ← iqu_billing_arrears ───────────────────────────────────
  {
    const c = counter("iqu_billing_arrears", rows("iqu_billing_arrears").length);
    for (const r of rows("iqu_billing_arrears")) {
      const famId = imported.families.get(int(r.account_id));
      if (!famId) {
        c.skipped.push({ key: text(r.id), reason: `its family (account ${int(r.account_id)}) was not imported` });
        continue;
      }
      const regId = idOrNull(r.registration_id);
      if (regId !== null && !imported.registrations.has(regId)) {
        c.skipped.push({ key: text(r.id), reason: `its registration ${regId} was not imported` });
        continue;
      }
      const v = mapArrears(r, famId, regId, ctx);
      if ("error" in v) {
        c.skipped.push({ key: text(r.id), reason: v.error });
        continue;
      }
      await upsert(
        tx,
        {
          sourceTable: "iqu_billing_arrears",
          sourceKey: text(r.id),
          targetTable: "arrears",
          source: { r, strip: ctx.strip },
          existing: async () => {
            const [a] = await tx
              .select({ id: arrears.id })
              .from(arrears)
              .where(and(eq(arrears.familyId, famId), sql`coalesce(${arrears.registrationId}, 0) = ${regId ?? 0}`, eq(arrears.month, v.month)));
            return a ? String(a.id) : null;
          },
          insert: async () => String((await tx.insert(arrears).values(v).returning({ id: arrears.id }))[0].id),
          update: async (k) => (await tx.update(arrears).set(v).where(eq(arrears.id, Number(k))).returning({ id: arrears.id })).length > 0,
        },
        c,
      );
    }
    report.tables.push(c);
  }

  // Stripe events ← iqu_billing_events (dedupe log; key: the event id) ─
  {
    const c = counter("iqu_billing_events", rows("iqu_billing_events").length);
    for (const r of rows("iqu_billing_events")) {
      const v = mapEvent(r, imported.families, ctx);
      if ("error" in v) {
        c.skipped.push({ key: text(r.id), reason: v.error });
        continue;
      }
      await upsert(
        tx,
        {
          sourceTable: "iqu_billing_events",
          sourceKey: text(r.id),
          targetTable: "stripe_events",
          source: { r, strip: ctx.strip },
          existing: async () =>
            (await tx.select({ id: stripeEvents.stripeEventId }).from(stripeEvents).where(eq(stripeEvents.stripeEventId, v.stripeEventId))).length ? v.stripeEventId : null,
          insert: async () => (await tx.insert(stripeEvents).values(v).returning({ id: stripeEvents.stripeEventId }))[0].id,
          update: async (k) => (await tx.update(stripeEvents).set(v).where(eq(stripeEvents.stripeEventId, k)).returning({ id: stripeEvents.stripeEventId })).length > 0,
        },
        c,
      );
    }
    report.tables.push(c);
  }

  // Discount ledger: copied as is, source "wp_import", never recalculated ─
  {
    const c = counter("iqu_discount_ledger", rows("iqu_discount_ledger").length);
    for (const r of rows("iqu_discount_ledger")) {
      const regId = int(r.registration_id);
      if (!imported.registrations.has(regId)) {
        c.skipped.push({ key: text(r.id), reason: `its registration ${regId} was not imported` });
        continue;
      }
      const kind = text(r.kind);
      const reason = text(r.reason);
      const month = ymd(r.month);
      const amountCents = cents(r.amount);
      if (kind !== "zakat" && kind !== "special") c.skipped.push({ key: text(r.id), reason: `unknown fund "${kind}"` });
      else if (!(LEDGER_REASONS as readonly string[]).includes(reason)) c.skipped.push({ key: text(r.id), reason: `no known reason ("${reason}")` });
      else if (!month || !month.endsWith("-01")) c.skipped.push({ key: text(r.id), reason: `month "${text(r.month)}" is not the 1st` });
      else if (amountCents <= 0) c.skipped.push({ key: text(r.id), reason: "amount is not positive" });
      else {
        const v = { month, registrationId: regId, kind, reason, amountCents, source: "wp_import", createdAt: utc(r.created_at) ?? ctx.now };
        await upsert(
          tx,
          {
            sourceTable: "iqu_discount_ledger",
            sourceKey: text(r.id),
            targetTable: "discount_ledger",
            source: r,
            existing: async () => {
              const [l] = await tx
                .select({ id: discountLedger.id })
                .from(discountLedger)
                .where(and(eq(discountLedger.month, month), eq(discountLedger.registrationId, regId), eq(discountLedger.kind, kind)));
              return l ? String(l.id) : null;
            },
            insert: async () => String((await tx.insert(discountLedger).values(v).returning({ id: discountLedger.id }))[0].id),
            update: async (k) => (await tx.update(discountLedger).set(v).where(eq(discountLedger.id, Number(k))).returning({ id: discountLedger.id })).length > 0,
          },
          c,
        );
      }
    }
    report.tables.push(c);
  }

  // Waitlist ────────────────────────────────────────────────────────
  {
    const c = counter("iqu_waitlist", rows("iqu_waitlist").length);
    for (const r of rows("iqu_waitlist")) {
      const program = ({ free: "monthly", summer: "summer", weekend: "weekend" } as Record<string, string>)[text(r.program)];
      const email = text(r.email).toLowerCase();
      if (!program || !email) {
        c.skipped.push({ key: text(r.id), reason: !email ? "no email" : `unknown program "${text(r.program)}"` });
        continue;
      }
      const cc = text(r.country);
      const v = { email, name: orNull(r.name), country: /^[A-Z]{2}$/.test(cc) ? cc : null, program, source: orNull(r.source), createdAt: utc(r.created_at) ?? ctx.now };
      await upsert(
        tx,
        {
          sourceTable: "iqu_waitlist",
          sourceKey: text(r.id),
          targetTable: "waitlist",
          source: r,
          existing: async () => {
            const [w] = await tx.select({ id: waitlist.id }).from(waitlist).where(and(sql`lower(${waitlist.email}) = ${email}`, eq(waitlist.program, program)));
            return w ? String(w.id) : null;
          },
          insert: async () => String((await tx.insert(waitlist).values(v).returning({ id: waitlist.id }))[0].id),
          update: async (k) => (await tx.update(waitlist).set(v).where(eq(waitlist.id, Number(k))).returning({ id: waitlist.id })).length > 0,
        },
        c,
      );
    }
    report.tables.push(c);
  }

  // Billing actions → audit_log (no natural key: provenance only) ────
  {
    const c = counter("iqu_billing_actions", rows("iqu_billing_actions").length);
    for (const r of rows("iqu_billing_actions")) {
      const mode = text(r.mode) === "live" ? "live" : "test";
      const amount = cents(r.amount);
      let reason = orNull(r.reason);
      if (amount > 0 && !reason) {
        reason = "(no reason recorded in WordPress)";
        warn(`action ${text(r.id)}: a money action with no reason; marked "${reason}".`);
      }
      const regId = idOrNull(r.registration_id);
      const famId = idOrNull(r.account_id);
      const v = {
        actor: wpUser(r.user_id) ?? "wp:system",
        action: text(r.action) || "unknown",
        entity: regId ? "registration" : famId ? "family" : "site",
        entityId: regId ? String(regId) : famId ? String(famId) : null,
        familyId: famId,
        registrationId: regId,
        mode,
        amountCents: amount > 0 ? amount : null,
        reason,
        stripeRef: ctx.strip && mode === "live" ? null : orNull(r.stripe_ref),
        at: utc(r.created_at) ?? ctx.now,
      };
      await upsert(
        tx,
        {
          sourceTable: "iqu_billing_actions",
          sourceKey: text(r.id),
          targetTable: "audit_log",
          source: { r, strip: ctx.strip },
          existing: async () => null,
          insert: async () => String((await tx.insert(auditLog).values(v).returning({ id: auditLog.id }))[0].id),
          update: async (k) => (await tx.update(auditLog).set(v).where(eq(auditLog.id, Number(k))).returning({ id: auditLog.id })).length > 0,
        },
        c,
      );
    }
    report.tables.push(c);
  }

  // Coupon use counts: the plugin's used_count must equal the redemptions rebuilt.
  for (const r of rows("iqu_coupons")) {
    const id = imported.coupons.get(int(r.id));
    if (!id) continue;
    const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(couponRedemptions).where(eq(couponRedemptions.couponId, id));
    if (Number(n.n) !== int(r.used_count)) report.mismatches.push(`coupon ${id}: used ${int(r.used_count)} times in WordPress, but ${n.n} imported registrations carry it.`);
  }
}

/* ── Row mappers (pure) ─────────────────────────────────────────────── */

type Err = { error: string };

export function mapCoupon(r: Row) {
  const code = text(r.code).toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) return { error: `coupon code "${code}" has an unexpected format` } as Err;
  const type = text(r.discount_type);
  const value = cents(r.discount_value);
  const status = text(r.status) || "active";
  if (status !== "active" && status !== "inactive") return { error: `unknown coupon status "${status}"` } as Err;
  let typed: { discountType: "percent" | "fixed"; valuePercent: number | null; valueCents: number | null };
  if (type === "percentage" || type === "") {
    if (value % 100 !== 0 || value < 100 || value > 10000) return { error: `percentage ${text(r.discount_value)} is not a whole number from 1 to 100` } as Err;
    typed = { discountType: "percent", valuePercent: value / 100, valueCents: null };
  } else if (type === "fixed") {
    if (value <= 0) return { error: "fixed amount is not positive" } as Err;
    typed = { discountType: "fixed", valuePercent: null, valueCents: value };
  } else return { error: `unknown discount type "${type}"` } as Err;
  return {
    code,
    occasion: orNull(r.occasion_name),
    // The plugin leaves course_type empty for "every course" (the code reads ALL-…).
    courseKey: text(r.course_type) || "ALL",
    ...typed,
    expiresOn: ymd(r.expire_date),
    maxUses: int(r.max_uses) > 0 ? int(r.max_uses) : null,
    status,
    description: orNull(r.description),
    createdBy: wpUser(r.created_by),
    createdAt: utc(r.created_at) ?? new Date(),
    updatedAt: utc(r.updated_at) ?? utc(r.created_at) ?? new Date(),
  };
}

export function mapFamily(r: Row, ctx: Ctx) {
  const mode = text(r.mode) === "live" ? "live" : text(r.mode) === "test" ? "test" : null;
  if (!mode) return { error: `unknown mode "${text(r.mode)}"` } as Err;
  const status = text(r.status) || "not_sent";
  if (!(FAMILY_STATUSES as readonly string[]).includes(status)) return { error: `unknown billing status "${status}"` } as Err;
  const studentType = text(r.student_type) || "current";
  if (studentType !== "new" && studentType !== "current") return { error: `unknown student type "${studentType}"` } as Err;
  const email = text(r.contact_email);
  if (!email) return { error: "no contact email" } as Err;
  const monthlyCents = cents(r.monthly_amount);
  const discountCents = cents(r.discount_amount);
  const netCents = cents(r.net_amount);
  if (netCents !== monthlyCents - discountCents) return { error: `net ${text(r.net_amount)} ≠ monthly ${text(r.monthly_amount)} − discount ${text(r.discount_amount)}` } as Err;
  const s = ctx.strip && mode === "live";
  const id = (v: Row[string], re: RegExp) => {
    const t = text(v);
    return !s && re.test(t) ? t : null;
  };
  return {
    mode,
    source: "wp_import",
    stripeCustomerId: id(r.stripe_customer_id, /^cus_[A-Za-z0-9]+$/),
    stripeSubscriptionId: id(r.stripe_subscription_id, /^sub_[A-Za-z0-9]+$/),
    guardianName: orNull(r.guardian_name),
    contactEmail: email,
    contactWhatsapp: orNull(r.contact_whatsapp),
    // A link token only verifies with the plugin's link key; never on staging.
    linkTokenHash: s ? null : orNull(r.token_hash),
    linkTokenHashPrev: s ? null : orNull(r.token_hash_prev),
    tokenCreatedAt: utc(r.token_created_at),
    studentType,
    monthlyCents,
    discountCents,
    netCents,
    firstChargeDate: ymd(r.first_charge_date),
    nextChargeAt: utc(r.next_charge_at),
    status,
    paymentMethodLabel: orNull(r.payment_method_label),
    lastPaymentStatus: orNull(r.last_payment_status),
    lastPaymentAt: utc(r.last_payment_at),
    lastFailureReason: orNull(r.last_failure_reason),
    emailSentAt: utc(r.email_sent_at),
    whatsappSentAt: utc(r.whatsapp_sent_at),
    checkoutSessionId: s ? null : orNull(r.checkout_session_id),
    checkoutCents: orNull(r.checkout_session_id) ? cents(r.checkout_amount) : null,
    checkoutCreatedAt: utc(r.checkout_created_at),
    linkOutdated: flag(r.link_outdated),
    reviewReason: orNull(r.review_reason),
    reviewNote: orNull(r.review_note),
    endsAt: utc(r.ends_at),
    owedFrom: ymd(r.owed_from),
    linkReminderBase: utc(r.link_reminder_base),
    linkReminders: int(r.link_reminders),
    createdBy: wpUser(r.created_by),
    createdAt: utc(r.created_at) ?? ctx.now,
    updatedAt: utc(r.updated_at) ?? utc(r.created_at) ?? ctx.now,
  };
}

const PROGRAM_OF: Record<string, (typeof PROGRAMS)[number]> = {
  free: "monthly",
  summer_level1: "summer_l1",
  summer_level2: "summer_l2",
  weekend_new: "weekend_new",
  weekend_existing: "weekend_existing",
};
const pick = <T extends string>(v: Row[string], allowed: readonly T[]): T | null => ((allowed as readonly string[]).includes(text(v)) ? (text(v) as T) : null);
const yesNo = (v: Row[string]) => (text(v) === "yes" ? true : text(v) === "no" ? false : null);

export function mapRegistration(
  r: Row,
  ctx: Ctx,
  links: { coupons: Map<number, number>; codeToCoupon: Map<string, number>; families: Map<number, number> },
  warn: (m: string) => void,
) {
  const program = PROGRAM_OF[text(r.form_type)];
  if (!program) return { error: `unknown form_type "${text(r.form_type)}"` } as Err;
  const status = pick(r.status, REGISTRATION_STATUSES);
  if (!status) return { error: `unknown status "${text(r.status)}"` } as Err;
  const createdVia = pick(r.created_via, ["public", "admin", "import"] as const);
  if (!createdVia) return { error: `unknown created_via "${text(r.created_via)}"` } as Err;
  if (!text(r.first_name) || !text(r.email)) return { error: "no first name or no email" } as Err;

  // Values the new schema cannot hold as typed are kept, word for word, in the admin note.
  const kept: string[] = [];
  const keep = (label: string, v: Row[string]) => {
    if (text(v)) kept.push(`${label} as entered: ${text(v)}`);
  };

  const phone = (col: string, label: string) => {
    const e = e164(r[col]);
    if (!e) keep(label, r[col]);
    return e;
  };
  const days = int(r.days_per_week);
  const dur = int(r.session_dur);
  const quran = text(r.quran_level);
  if (quran && !(QURAN_LEVELS as readonly string[]).includes(quran)) keep("Quran level", r.quran_level);
  if (text(r.days_per_week) && !(days >= 1 && days <= 7)) keep("Days per week", r.days_per_week);
  if (text(r.session_dur) && ![30, 40, 45, 50, 60].includes(dur)) keep("Session length", r.session_dur);
  const teacher = pick(r.teacher_pref, ["male", "female", "no_preference"] as const);
  if (text(r.teacher_pref) && !teacher) keep("Teacher preference", r.teacher_pref);
  const admission = pick(r.admission_fee, ["standard", "supported", "complimentary", "flexible", "free", "50", "30"] as const);
  if (text(r.admission_fee) && !admission) keep("Admission fee", r.admission_fee);
  const res = country(r.country_res);
  const origin = country(r.country_origin);
  if (res.name && !res.code) warn(`country of residence "${res.name}" has no country code (kept as text).`);
  if (origin.name && !origin.code) warn(`country of origin "${origin.name}" has no country code (kept as text).`);

  // Coupon: by id, else by the code the plugin also stored.
  const couponWp = int(r.coupon_id);
  let couponId = couponWp > 0 ? (links.coupons.get(couponWp) ?? null) : null;
  if (!couponId && text(r.coupon_code)) couponId = links.codeToCoupon.get(text(r.coupon_code).toUpperCase()) ?? null;
  if ((couponWp > 0 || text(r.coupon_code)) && !couponId) return { error: `its coupon (${couponWp || text(r.coupon_code)}) is not in the snapshot` } as Err;
  if (couponId && !flag(r.zakat_declaration)) return { error: "a coupon without the Zakat declaration (the plugin always required both)" } as Err;
  if (couponId && flag(r.special_discount)) return { error: "a coupon together with the Special plan (the plugin never combined them)" } as Err;

  const accountWp = int(r.billing_account_id);
  const familyId = accountWp > 0 ? (links.families.get(accountWp) ?? null) : null;
  if (accountWp > 0 && !familyId) warn(`billing account ${accountWp} is not in the snapshot; the registration is imported without a family.`);

  const fund = pick(r.agreed_fee_fund, ["zakat", "special"] as const);
  const session = text(r.pay_session_id);
  const ageAt = int(r.age);
  // Phones first: a number that is not E.164 adds its text to `kept`, which the note carries.
  const whatsappE164 = phone("whatsapp", "WhatsApp");
  const guardianContactE164 = phone("guardian_contact", "Guardian contact");
  const guardianWhatsappE164 = phone("guardian_whatsapp", "Guardian WhatsApp");
  const note = [orNull(r.admin_note), kept.length ? `[Imported from WordPress] ${kept.join(" · ")}` : null].filter(Boolean).join("\n") || null;

  return {
    program,
    status,
    createdVia,
    firstName: text(r.first_name),
    lastName: text(r.last_name),
    dateOfBirth: ymd(r.date_of_birth),
    ageAtSignup: ageAt > 0 ? ageAt : null,
    guardianName: orNull(r.guardian_name),
    email: text(r.email),
    whatsappE164,
    guardianContactE164,
    guardianWhatsappE164,
    countryResCode: res.code,
    countryResName: res.name,
    countryOriginCode: origin.code,
    countryOriginName: origin.name,
    countryIp: /^[A-Z]{2}$/.test(text(r.country_ip)) ? text(r.country_ip) : null,
    languages: list(r.languages),
    existingStudent: flag(r.existing_student),
    quranLevel: quran && (QURAN_LEVELS as readonly string[]).includes(quran) ? quran : null,
    memorized: orNull(r.memorized),
    teacherPref: teacher,
    courseKey: orNull(r.course_type),
    daysPerWeek: days >= 1 && days <= 7 ? days : null,
    preferredDays: list(r.preferred_days),
    sessionMinutes: [30, 40, 45, 50, 60].includes(dur) ? dur : null,
    timeSlotText: orNull(r.time_slot),
    perClassCents: centsOrNull(r.per_class_rate),
    calculatedCents: centsOrNull(r.calculated_amount),
    discountCents: cents(r.discount_amount),
    paymentCents: centsOrNull(r.payment_amount),
    specialPlan: flag(r.special_discount),
    couponId,
    zakatDeclaration: flag(r.zakat_declaration),
    agreedFeeCents: centsOrNull(r.agreed_fee),
    agreedFeeFund: fund,
    admissionFee: admission,
    flexibleFeeNote: orNull(r.flexible_fee_note),
    paymentStatus: orNull(r.payment_status),
    paymentMethod: orNull(r.payment_method),
    transactionId: orNull(r.transaction_id),
    checkoutSessionId: ctx.strip && session.includes("_live_") ? null : orNull(r.pay_session_id),
    familyId,
    referral: orNull(r.referral),
    referralOther: orNull(r.referral_other),
    waUpdates: yesNo(r.wa_updates),
    futureUpdates: yesNo(r.future_updates),
    whatsappGroup: pick(r.whatsapp_group, ["yes", "no", "maybe"] as const),
    marketingConsent: pick(r.marketing_consent, ["granted", "denied", "unknown"] as const) ?? "unknown",
    // fbp, fbc and the user agent are not exported (no marketing consent on any row; P1 decision 4).
    remindersSent: int(r.reminders_sent),
    adminNote: note,
    leftAt: utc(r.left_at),
    billingEndedAt: utc(r.billing_ended_at),
    reenrolledAt: utc(r.reenrolled_at),
    archivedAt: utc(r.archived_at),
    archivedBy: wpUser(r.archived_by),
    refundedCents: cents(r.refunded_amount),
    legacyFeePref: orNull(r.fee_pref),
    legacyFreeRequestReason: orNull(r.free_request_reason),
    legacyDevice: orNull(r.device),
    legacyEnrollmentLevel: orNull(r.enrollment_level),
    createdAt: utc(r.created_at) ?? ctx.now,
    updatedAt: utc(r.updated_at) ?? utc(r.created_at) ?? ctx.now,
  };
}

export function mapPayment(r: Row, familyId: number, ctx: Ctx, warn: (m: string) => void) {
  const mode = text(r.mode) === "live" ? "live" : "test";
  const s = ctx.strip && mode === "live";
  const invoice = text(r.stripe_invoice_id);
  if (!/^in_[A-Za-z0-9]+$/.test(invoice)) return { error: `invoice id "${invoice}" is not a Stripe invoice id` } as Err;
  // billing-db.php:932-934: '' is an older paid row recorded before the payment history existed.
  const status = text(r.status) || "paid";
  const paid = cents(r.amount_paid) > 0 ? cents(r.amount_paid) : status === "paid" ? cents(r.amount) : 0;
  const refunded = cents(r.amount_refunded);
  if (refunded > paid) return { error: `refunded ${text(r.amount_refunded)} is more than paid` } as Err;
  const stripeLink = (v: Row[string]) => {
    const t = text(v);
    if (!t || s) return null;
    if (/^https:\/\/([a-z0-9-]+\.)*stripe\.com\//.test(t)) return t;
    warn(`a receipt link outside stripe.com was dropped (${t.slice(0, 40)}…).`);
    return null;
  };
  const month = text(r.period_month);
  return {
    stripeInvoiceId: s ? `in_stripped${int(r.id)}` : invoice,
    familyId,
    mode,
    status,
    periodMonth: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
    periodStart: utc(r.period_start),
    periodEnd: utc(r.period_end),
    amountDueCents: cents(r.amount_due),
    amountPaidCents: paid,
    amountRefundedCents: refunded,
    methodLabel: orNull(r.method_label),
    hostedInvoiceUrl: stripeLink(r.hosted_invoice_url),
    invoicePdf: stripeLink(r.invoice_pdf),
    receiptNumber: orNull(r.receipt_number),
    attemptCount: int(r.attempt_count),
    failureReason: orNull(r.failure_reason),
    paidAt: utc(r.paid_at),
    receiptClaimedAt: utc(r.receipt_sent_at),
    receiptSentAt: utc(r.receipt_sent_at),
    createdAt: utc(r.created_at) ?? ctx.now,
    updatedAt: utc(r.updated_at) ?? utc(r.created_at) ?? ctx.now,
  };
}

/** billing-arrears.php: due → open, team → escalated; scheduled, charged, waived and stopped as they are. */
const ARREARS_STATUS: Record<string, string> = { owed: "open", due: "open", scheduled: "scheduled", team: "escalated", charged: "charged", waived: "waived", stopped: "stopped" };

export function mapArrears(r: Row, familyId: number, registrationId: number | null, ctx: Ctx) {
  const mode = text(r.mode) === "live" ? "live" : "test";
  const s = ctx.strip && mode === "live";
  const status = ARREARS_STATUS[text(r.status)];
  if (!status) return { error: `unknown arrears status "${text(r.status)}"` } as Err;
  const month = ymd(r.month);
  if (!month || !month.endsWith("-01")) return { error: `month "${text(r.month)}" is not the 1st` } as Err;
  const amountCents = cents(r.amount);
  if (amountCents <= 0) return { error: "amount is not positive" } as Err;
  const reason = orNull(r.reason);
  if (status === "waived" && !reason) return { error: "waived with no reason" } as Err;
  const sid = (v: Row[string]) => (s ? null : orNull(v));
  return {
    mode,
    familyId,
    registrationId,
    month,
    amountCents,
    source: orNull(r.source),
    oldInvoiceId: sid(r.old_invoice_id),
    itemId: sid(r.item_id),
    chargedInvoiceId: sid(r.charged_invoice_id),
    status,
    reason,
    userId: wpUser(r.user_id),
    createdAt: utc(r.created_at) ?? ctx.now,
    updatedAt: utc(r.updated_at) ?? utc(r.created_at) ?? ctx.now,
  };
}

/** The plugin's webhook results (billing-webhook.php:140-374, billing-db.php:871-878) → ours; the original stays in the note. */
const EVENT_RESULT: Record<string, "processing" | "processed" | "ignored_other_mode" | "not_iqu" | "duplicate" | "error"> = {
  ok: "processed",
  ignored: "processed",
  in_review: "processed",
  not_usd: "processed",
  amount_mismatch: "processed",
  duplicate_alert: "processed",
  no_account: "not_iqu",
  duplicate: "duplicate",
  error: "error",
};

export function mapEvent(r: Row, families: Map<number, number>, ctx: Ctx) {
  const mode = text(r.mode) === "live" ? "live" : "test";
  const id = text(r.stripe_event_id);
  if (!/^evt_[A-Za-z0-9]+$/.test(id)) return { error: `event id "${id}" is not a Stripe event id` } as Err;
  const wpResult = text(r.result) || "received";
  const processedAt = utc(r.processed_at);
  const result = processedAt ? (EVENT_RESULT[wpResult] ?? "error") : "error";
  const wpNote = text(r.note);
  const acc = idOrNull(r.account_id);
  return {
    stripeEventId: ctx.strip && mode === "live" ? `evt_stripped${int(r.id)}` : id,
    mode,
    type: text(r.type) || "unknown",
    familyId: acc !== null ? (families.get(acc) ?? acc) : null,
    receivedAt: utc(r.received_at) ?? ctx.now,
    processedAt,
    result,
    note: `wp: ${processedAt ? wpResult : "received, never processed"}${wpNote ? ` · ${wpNote}` : ""}`.slice(0, 500),
  };
}

/* ── Reconcile ──────────────────────────────────────────────────────── */

type Sums = Record<string, number>;

/** Money of the imported rows, read back from the database (only rows recorded in wp_import_rows). */
async function targetSums(tx: AnyTx): Promise<Sums> {
  const one = async (q: ReturnType<typeof sql>) => Number(((await tx.execute(q)) as unknown as { rows: { v: string | number | null }[] }).rows[0]?.v ?? 0);
  const via = (target: string, alias: string, key = `${alias}.id::text`) =>
    sql.raw(`JOIN wp_import_rows w ON w.target_table = '${target}' AND w.target_key = ${key}`);
  return {
    ledgerZakat: await one(sql`SELECT coalesce(sum(l.amount_cents),0) v FROM discount_ledger l ${via("discount_ledger", "l")} WHERE l.kind = 'zakat'`),
    ledgerSpecial: await one(sql`SELECT coalesce(sum(l.amount_cents),0) v FROM discount_ledger l ${via("discount_ledger", "l")} WHERE l.kind = 'special'`),
    ledgerZakatRows: await one(sql`SELECT count(*) v FROM discount_ledger l ${via("discount_ledger", "l")} WHERE l.kind = 'zakat'`),
    ledgerSpecialRows: await one(sql`SELECT count(*) v FROM discount_ledger l ${via("discount_ledger", "l")} WHERE l.kind = 'special'`),
    paid: await one(sql`SELECT coalesce(sum(p.amount_paid_cents),0) v FROM payments p ${via("payments", "p")}`),
    due: await one(sql`SELECT coalesce(sum(p.amount_due_cents),0) v FROM payments p ${via("payments", "p")}`),
    refunded: await one(sql`SELECT coalesce(sum(p.amount_refunded_cents),0) v FROM payments p ${via("payments", "p")}`),
    regPayment: await one(sql`SELECT coalesce(sum(r.payment_cents),0) v FROM registrations r ${via("registrations", "r")}`),
    regDiscount: await one(sql`SELECT coalesce(sum(r.discount_cents),0) v FROM registrations r ${via("registrations", "r")}`),
    regAgreed: await one(sql`SELECT coalesce(sum(r.agreed_fee_cents),0) v FROM registrations r ${via("registrations", "r")}`),
    famMonthly: await one(sql`SELECT coalesce(sum(f.monthly_cents),0) v FROM families f ${via("families", "f")}`),
    famNet: await one(sql`SELECT coalesce(sum(f.net_cents),0) v FROM families f ${via("families", "f")}`),
    arrears: await one(sql`SELECT coalesce(sum(a.amount_cents),0) v FROM arrears a ${via("arrears", "a")}`),
  };
}

function reconcileMoney(snap: Snapshot, report: ImportReport, t: Sums): void {
  const rows = (tbl: SourceTable) => snap.tables[tbl].rows as Row[];
  const sum = (tbl: SourceTable, f: (r: Row) => number, where: (r: Row) => boolean = () => true) => rows(tbl).filter(where).reduce((a, r) => a + f(r), 0);
  const c = snap.checks;
  const isKind = (k: string) => (r: Row) => text(r.kind) === k;
  const paidOf = (r: Row) => (cents(r.amount_paid) > 0 ? cents(r.amount_paid) : (text(r.status) || "paid") === "paid" ? cents(r.amount) : 0);
  const checks: [string, number, number, number][] = [
    ["Ledger Zakat (cents)", c.ledger.zakat?.cents ?? 0, sum("iqu_discount_ledger", (r) => cents(r.amount), isKind("zakat")), t.ledgerZakat],
    ["Ledger Special (cents)", c.ledger.special?.cents ?? 0, sum("iqu_discount_ledger", (r) => cents(r.amount), isKind("special")), t.ledgerSpecial],
    ["Ledger Zakat (rows)", c.ledger.zakat?.rows ?? 0, rows("iqu_discount_ledger").filter(isKind("zakat")).length, t.ledgerZakatRows],
    ["Ledger Special (rows)", c.ledger.special?.rows ?? 0, rows("iqu_discount_ledger").filter(isKind("special")).length, t.ledgerSpecialRows],
    // amount_paid: an older row without it is counted by its amount, as the importer stores it.
    ["Payments paid (cents)", c.payments.amount_paid_cents + sum("iqu_billing_payments", (r) => (cents(r.amount_paid) > 0 ? 0 : paidOf(r))), sum("iqu_billing_payments", paidOf), t.paid],
    ["Payments due (cents)", c.payments.amount_due_cents, sum("iqu_billing_payments", (r) => cents(r.amount_due)), t.due],
    ["Payments refunded (cents)", c.payments.amount_refunded_cents, sum("iqu_billing_payments", (r) => cents(r.amount_refunded)), t.refunded],
    ["Registrations fee (cents)", c.registrations.payment_amount_cents, sum("iqu_registrations", (r) => cents(r.payment_amount)), t.regPayment],
    ["Registrations discount (cents)", c.registrations.discount_amount_cents, sum("iqu_registrations", (r) => cents(r.discount_amount)), t.regDiscount],
    ["Registrations agreed fees (cents)", c.registrations.agreed_fee_cents, sum("iqu_registrations", (r) => cents(r.agreed_fee)), t.regAgreed],
    ["Families monthly (cents)", c.accounts.monthly_amount_cents, sum("iqu_billing_accounts", (r) => cents(r.monthly_amount)), t.famMonthly],
    ["Families net (cents)", c.accounts.net_amount_cents, sum("iqu_billing_accounts", (r) => cents(r.net_amount)), t.famNet],
    ["Arrears (cents)", c.arrears_cents, sum("iqu_billing_arrears", (r) => cents(r.amount)), t.arrears],
  ];
  for (const [name, source, snapshot, target] of checks) {
    const ok = source === snapshot && snapshot === target;
    report.money.push({ name, source, snapshot, target, ok });
    if (!ok) report.mismatches.push(`${name}: MySQL ${source}, snapshot rows ${snapshot}, imported ${target}.`);
  }
  for (const tc of report.tables) {
    const done = tc.inserted + tc.updated + tc.unchanged;
    if (done + tc.skipped.length !== tc.source) report.mismatches.push(`${tc.table}: ${tc.source} in the source, ${done} imported + ${tc.skipped.length} skipped.`);
  }
}

/** P0 note: identity columns continue above the highest id (imported or not), never below the sequence's own position. */
const SEQUENCED = ["registrations", "families", "coupons", "family_members", "payments", "arrears", "audit_log", "discount_ledger", "review_reasons", "waitlist"];

/**
 * setval is NOT undone by a rollback, so a dry run only computes the next id
 * it would set; a write run sets it (inside the same transaction as the rows).
 */
async function setSequences(tx: AnyTx, report: ImportReport, apply: boolean): Promise<void> {
  for (const t of SEQUENCED) {
    const next = `GREATEST(COALESCE((SELECT max(id) FROM ${t}), 0), COALESCE(pg_sequence_last_value(pg_get_serial_sequence('${t}', 'id')::regclass), 0)) + 1`;
    const res = (await tx.execute(
      sql.raw(apply ? `SELECT setval(pg_get_serial_sequence('${t}', 'id'), ${next}, false) AS next` : `SELECT ${next} AS next`),
    )) as unknown as { rows: { next: string | number }[] };
    report.sequences[t] = Number(res.rows[0].next);
  }
}
