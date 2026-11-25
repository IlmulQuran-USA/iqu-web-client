import { and, asc, eq, gt, inArray, lte, ne, notExists, sql } from "drizzle-orm";
import { auditLog, families, familyMembers, registrations } from "../../../db/schema.ts";
import type { AnyDb } from "../../../db/types.ts";
import { cardReminderEmail } from "../enroll/messages.ts";
import { enqueue } from "../outbox/outbox.ts";
import type { StripeMode } from "../stripe-mode.ts";

/*
 * Card reminders and the 7-day expiry (IQU_Enrollment::run_reminders,
 * includes/class-iqu-enrollment.php:343-398, plugin 3.7.20; claim_reminder
 * includes/class-iqu-database.php:855-863). Ported rule for rule (EN = that file):
 *
 * - who: website enrollments (created_via public, EN:368) in monthly classes,
 *   still "card_pending";
 * - reminder 1: 24 h after the enrollment; reminder 2 ("Last reminder"): 72 h
 *   after. Each at most once, by the reminders_sent bits (1 = 24 h, 2 = 72 h),
 *   claimed in one UPDATE before the email is queued, so two runs at the same
 *   time send it once (EN:392-397). Past 72 h with the first never sent, only
 *   the last one goes out, and both bits are set (EN:393-394);
 * - no reminder when the family has no billing record, already has a Stripe
 *   subscription, or is already billing (free_month / waiting_first_charge /
 *   active) (EN:390);
 * - after 7 days with no card or bank on file: card_pending → expired, in one
 *   conditional UPDATE so a late webhook still wins (EN:382-386). Nothing is
 *   deleted; a later card still enrolls (architecture §3). Each expiry is
 *   written to audit_log (actor system:card-expiry).
 *
 * Not ported yet, with reason:
 * - the Stripe read-back before a reminder or an expiry (EN:374-381, the missed-
 *   webhook safety net) needs Stripe: P2;
 * - the "Finish enrollment" link is the family's own Stripe link, created in P2.
 *   Until a link exists, `cardLink` returns null: the reminder is NOT claimed
 *   and NOT sent (counted as `noLink`), so it goes out on the first run after P2.
 * - Summer 24 h reminders, admin payment-link reminders, deferred sibling lines
 *   and arrears (EN:400-407) all act on Stripe objects: P2.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EXPIRE_DAYS = 7; // EN:38
const BIT_24H = 1; // EN:31
const BIT_72H = 2; // EN:32
const ACTIVE = ["free_month", "waiting_first_charge", "active"]; // EN:39
const BATCH = 200; // EN:353, EN:361

export type ReminderDeps = {
  mode: StripeMode;
  /** The family's "Finish enrollment" link, or null while none exists (P2). */
  cardLink: (family: typeof families.$inferSelect) => Promise<string | null> | string | null;
};

export type ReminderReport = { checked: number; reminded24: number; reminded72: number; expired: number; noLink: number; outboxIds: number[] };

export async function runCardReminders(db: AnyDb, now: Date, deps: ReminderDeps): Promise<ReminderReport> {
  const report: ReminderReport = { checked: 0, reminded24: 0, reminded72: 0, expired: 0, noLink: 0, outboxIds: [] };
  const expireBefore = new Date(now.getTime() - EXPIRE_DAYS * DAY);
  const pending = and(eq(registrations.program, "monthly"), eq(registrations.status, "card_pending"));

  // EN:356-363: over 7 days old and no subscription on file in this mode.
  const withSubscription = db
    .select({ one: sql`1` })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(
      and(
        eq(familyMembers.registrationId, registrations.id),
        eq(familyMembers.mode, deps.mode),
        ne(sql`coalesce(${families.stripeSubscriptionId}, '')`, ""),
      ),
    );
  const expire = await db
    .select()
    .from(registrations)
    .where(and(pending, lte(registrations.createdAt, expireBefore), notExists(withSubscription)))
    .orderBy(asc(registrations.id))
    .limit(BATCH);

  // EN:351-355: 1–7 days old and the last (72 h) reminder not sent yet.
  const remind = await db
    .select()
    .from(registrations)
    .where(
      and(
        pending,
        lte(registrations.createdAt, new Date(now.getTime() - DAY)),
        gt(registrations.createdAt, expireBefore),
        eq(sql`(${registrations.remindersSent} & ${BIT_72H})`, 0),
      ),
    )
    .orderBy(asc(registrations.id))
    .limit(BATCH);

  const rows = [...expire, ...remind];
  if (!rows.length) return report;

  // The family of each registration in this mode (account_for_registration).
  const fams = await db
    .select({ registrationId: familyMembers.registrationId, family: families })
    .from(familyMembers)
    .innerJoin(families, and(eq(families.id, familyMembers.familyId), eq(families.mode, deps.mode)))
    .where(and(inArray(familyMembers.registrationId, rows.map((r) => r.id)), eq(familyMembers.mode, deps.mode)));
  const familyOf = new Map(fams.map((f) => [f.registrationId, f.family]));

  for (const reg of rows) {
    if (reg.createdVia !== "public") continue; // EN:368
    report.checked++;
    const age = now.getTime() - reg.createdAt.getTime();
    const bits = reg.remindersSent;
    const acc = familyOf.get(reg.id) ?? null;

    if (age >= EXPIRE_DAYS * DAY) {
      // EN:382-386: a card or bank already on file (waiting for a review) is not expired.
      if (!acc || !acc.stripeSubscriptionId) {
        const done = await db.transaction(async (tx) => {
          const moved = await tx
            .update(registrations)
            .set({ status: "expired", updatedAt: now })
            .where(and(eq(registrations.id, reg.id), eq(registrations.status, "card_pending")))
            .returning({ id: registrations.id });
          if (!moved.length) return false;
          await tx.insert(auditLog).values({
            actor: "system:card-expiry",
            action: "expire_card_step",
            entity: "registration",
            entityId: String(reg.id),
            registrationId: reg.id,
            familyId: acc?.id ?? null,
            mode: deps.mode,
            reason: "No card or bank account added within 7 days",
            before: { status: "card_pending" },
            after: { status: "expired" },
            at: now,
          });
          return true;
        });
        if (done) report.expired++;
      }
      continue;
    }

    // EN:389-390: card already added (the webhook completes it), or no record to link to.
    if (!acc || acc.stripeSubscriptionId || ACTIVE.includes(acc.status)) continue;

    const last = age >= 72 * HOUR && !(bits & BIT_72H);
    const first = !last && age < 72 * HOUR && !(bits & BIT_24H);
    if (!last && !first) continue;

    const link = await deps.cardLink(acc);
    if (!link) {
      report.noLink++;
      continue;
    }

    // EN:392-397: claim first (one UPDATE), queue the email only when this run claimed it.
    const set = last ? BIT_72H | BIT_24H : BIT_24H;
    const unless = last ? BIT_72H : BIT_24H;
    const ids = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(registrations)
        .set({ remindersSent: sql`${registrations.remindersSent} | ${set}`, updatedAt: now })
        .where(and(eq(registrations.id, reg.id), eq(sql`(${registrations.remindersSent} & ${unless})`, 0)))
        .returning({ id: registrations.id });
      if (!claimed.length) return [];
      const email = cardReminderEmail(reg.email, reg.firstName, link, last);
      return enqueue(tx, [{ kind: "email", dedupeKey: `card-reminder:${reg.id}:${last ? "72h" : "24h"}`, payload: { template: last ? "card_reminder_72h" : "card_reminder_24h", ...email } }], now);
    });
    if (ids.length) {
      report.outboxIds.push(...ids);
      if (last) report.reminded72++;
      else report.reminded24++;
    }
  }
  return report;
}
