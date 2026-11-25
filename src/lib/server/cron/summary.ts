import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql, sum } from "drizzle-orm";
import { families, familyMembers, payments, registrations, stripeEvents } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";
import { siteMonthStart, siteYmd } from "../dhaka.ts";
import { blocksSince, formatCounts } from "../enroll/blocks.ts";
import { composeTelegram, dhakaTime, type Row } from "../enroll/messages.ts";
import { enqueue } from "../outbox/outbox.ts";
import type { StripeMode } from "../stripe-mode.ts";
import type { Donations } from "./donations.ts";
import { billingPrice } from "./ledger.ts";

/*
 * The 9 PM (Asia/Dhaka) daily summary: ONE Telegram message with
 * registrations, tuition and donations (architecture, Resolved facts). It is
 * the plugin's message with every line its modules add, in the plugin's order
 * (filter iqu_daily_summary_rows: eligibility and billing at priority 10 —
 * eligibility registers first, billing inside plugins_loaded — then the billing
 * chase at 15 and enrollment at 20):
 *
 *   core        class-iqu-notifier.php:299-372 (N)
 *   eligibility class-iqu-eligibility.php:306-312 (EL)
 *   tuition     billing/class-iqu-billing-summary.php:33-111 (BSU)
 *   chase       billing/class-iqu-billing-chase.php:200-235 (CH)
 *   enrollment  class-iqu-enrollment.php:51-73 (EN)
 *
 * Changed on purpose:
 * - N18: "Awaiting review" counts registrations in `pending_review` (the
 *   plugin counted `pending`, which is never the review status); archived
 *   records are not awaiting anything and are left out.
 * - Donations come from WordPress (donations.ts). Unavailable → the line reads
 *   "Donations: not available today", the Donors and Month to date lines are
 *   left out (they would be guesses), and the footer never calls it a quiet day.
 * - The time in the title says "Dhaka time" (N19).
 * Counts and totals only: no names, no emails (BSU:10).
 */

const DAY = 86_400_000;

/** '$' . number_format($x, 2) (IQU_Pricing::format, IQU_Zeffy_DB::money): "$1,243.00". */
export function money2(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type SummaryDeps = {
  mode: StripeMode;
  donations: Donations | null;
  /** Why families cannot add a card right now ('' when they can); shown while the payment step is on (CH:227-230). */
  cardStepProblem: string;
  freePaymentStep: boolean;
};

export type Summary = { title: string; rows: Row[]; footer: string; html: string };

async function one(db: Queryable, where: ReturnType<typeof and>): Promise<number> {
  const [r] = await db.select({ n: count() }).from(registrations).where(where);
  return Number(r?.n ?? 0);
}

/** BSU:33-79: tuition numbers for the last 24 hours and right now, in the site's Stripe mode. */
async function tuitionStats(db: Queryable, now: Date, mode: StripeMode) {
  const by = new Map<string, { n: number; total: number }>();
  for (const r of await db
    .select({ status: families.status, n: count(), total: sum(families.netCents) })
    .from(families)
    .where(eq(families.mode, mode))
    .groupBy(families.status)) {
    by.set(r.status, { n: Number(r.n), total: Number(r.total ?? 0) });
  }
  const n = (s: string[]) => s.reduce((a, k) => a + (by.get(k)?.n ?? 0), 0);
  const total = (s: string[]) => s.reduce((a, k) => a + (by.get(k)?.total ?? 0), 0);
  const billing = ["free_month", "waiting_first_charge", "active", "past_due"];

  const paidBetween = async (from: Date, to: Date) => {
    // billing-db.php:928-938: paid tuition only, not a $0 free-month invoice.
    const [r] = await db
      .select({ n: count(), total: sum(payments.amountPaidCents) })
      .from(payments)
      .where(and(eq(payments.mode, mode), gte(payments.paidAt, from), lt(payments.paidAt, to), eq(payments.status, "paid"), sql`${payments.amountPaidCents} > 0`));
    return { count: Number(r?.n ?? 0), total: Number(r?.total ?? 0) };
  };
  const [stale] = await db
    .select({ n: count() })
    .from(families)
    .where(
      and(
        eq(families.mode, mode),
        inArray(families.status, ["not_sent", "link_sent"]),
        lt(sql`coalesce(${families.emailSentAt}, ${families.whatsappSentAt}, ${families.createdAt})`, new Date(now.getTime() - 7 * DAY)),
      ),
    );
  const [trial] = await db
    .select({ n: count() })
    .from(families)
    .where(and(eq(families.mode, mode), eq(families.status, "free_month"), isNotNull(families.nextChargeAt), lt(families.nextChargeAt, new Date(now.getTime() + 7 * DAY))));
  const [failed] = await db
    .select({ n: count() })
    .from(stripeEvents)
    .where(and(eq(stripeEvents.mode, mode), eq(stripeEvents.type, "invoice.payment_failed"), gte(stripeEvents.receivedAt, new Date(now.getTime() - DAY))));

  const soon = new Date(now.getTime() + 60_000);
  return {
    accounts: [...by.values()].reduce((a, v) => a + v.n, 0),
    paidToday: await paidBetween(new Date(now.getTime() - DAY), soon),
    // BSU:64-65: the month in the site time zone.
    monthToDate: await paidBetween(siteMonthStart(now), soon),
    failedToday: Number(failed?.n ?? 0),
    problems: n(["past_due", "unpaid", "paused"]),
    noCard: n(["not_sent", "link_sent", "bank_verification"]),
    noCardStale: Number(stale?.n ?? 0),
    trialEnding: Number(trial?.n ?? 0),
    onBilling: n(billing),
    recurring: total(billing),
  };
}

/** BS:544-550 group_for_status. */
function groupForStatus(status: string): string {
  if (["not_sent", "link_sent", "bank_verification"].includes(status)) return "link_sent";
  if (["free_month", "waiting_first_charge", "active", "ending"].includes(status)) return "active";
  if (["past_due", "unpaid", "paused", "review"].includes(status)) return "failed";
  return "not_billed";
}

/** CH:200-235 over BS:556-590 student_rows: monthly students with no billing record, and links sent a week ago with no card. */
async function chaseRows(db: Queryable, now: Date, mode: StripeMode): Promise<Row[]> {
  const regs = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.program, "monthly"), isNull(registrations.archivedAt), isNull(registrations.leftAt)))
    .orderBy(desc(registrations.id));
  const accs = regs.length
    ? await db
        .select({ registrationId: familyMembers.registrationId, family: families })
        .from(familyMembers)
        .innerJoin(families, and(eq(families.id, familyMembers.familyId), eq(families.mode, mode)))
        .where(and(eq(familyMembers.mode, mode), inArray(familyMembers.registrationId, regs.map((r) => r.id))))
    : [];
  const accOf = new Map(accs.map((a) => [a.registrationId, a.family]));
  const older = (at: Date | null, days: number) => at !== null && at.getTime() < now.getTime() - days * DAY;

  const c: Record<"pending_review" | "not_set_up" | "needs_course", [number, number]> = { pending_review: [0, 0], not_set_up: [0, 0], needs_course: [0, 0] };
  let linkOld = 0;
  for (const reg of regs) {
    const acc = accOf.get(reg.id);
    if (acc) {
      if (groupForStatus(acc.status) === "link_sent") {
        // CH:76-79: the later of the email and WhatsApp sends, else when the record was made.
        const sends = [acc.emailSentAt, acc.whatsappSentAt].filter((d): d is Date => d !== null);
        const sent = sends.length ? new Date(Math.max(...sends.map((d) => d.getTime()))) : acc.createdAt;
        if (older(sent, 7)) linkOld++;
      }
      continue;
    }
    const p = billingPrice(reg);
    const group = p.billable ? "not_set_up" : p.needsInput ? "needs_course" : "not_billed";
    const key = reg.status === "pending_review" ? "pending_review" : group;
    if (!(key in c)) continue;
    const bucket = c[key as keyof typeof c];
    bucket[0]++;
    if (older(reg.createdAt, 3)) bucket[1]++;
  }
  const rows: Row[] = [];
  const labels: [keyof typeof c, string][] = [
    ["not_set_up", "No billing — Not set up"],
    ["needs_course", "No billing — Needs course"],
    ["pending_review", "No billing — Pending review"],
  ];
  for (const [k, label] of labels) if (c[k][0] > 0) rows.push([label, `${c[k][0]}${c[k][1] ? ` (${c[k][1]} over 3 days)` : ""}`]);
  if (linkOld > 0) rows.push(["Link sent, no card (over 7 days)", String(linkOld)]);
  return rows;
}

export async function buildDailySummary(db: Queryable, now: Date, deps: SummaryDeps): Promise<Summary> {
  const since = new Date(now.getTime() - DAY);
  const rows: Row[] = [];

  // ── Core (N:307-357) ──
  // 3.7.19: imported rows are not new registrations (N:324-329).
  const regCount = await one(db, and(gte(registrations.createdAt, since), ne(registrations.createdVia, "import")));
  const awaiting = await one(db, and(eq(registrations.status, "pending_review"), isNull(registrations.archivedAt))); // N18
  const d = deps.donations;
  if (d) {
    rows.push(["Donations", `${d.count} (${money2(d.netCents)})`], ["Donors", String(d.donors)], ["Registrations", String(regCount)], ["Month to date", money2(d.monthCents)]);
  } else {
    rows.push(["Donations", "not available today"], ["Registrations", String(regCount)]);
  }
  if (awaiting > 0) rows.push(["Awaiting review", `${awaiting} pending registration${awaiting === 1 ? "" : "s"}`]);

  // ── Eligibility (EL:306-312) ──
  const blocks = await blocksSince(db, since, now);
  if (blocks.enforce.length) rows.push(["Blocked enrollments", formatCounts(blocks.enforce)]);
  if (blocks.monitor.length) rows.push(["Would be blocked (monitor)", formatCounts(blocks.monitor)]);

  // ── Tuition (BSU:85-101) ──
  const s = await tuitionStats(db, now, deps.mode);
  if (s.accounts > 0) {
    const test = deps.mode === "test" ? " [test]" : "";
    rows.push([`Tuition paid${test}`, `${s.paidToday.count} (${money2(s.paidToday.total)})`]);
    if (s.failedToday > 0) rows.push([`Tuition failed${test}`, String(s.failedToday)]);
    if (s.problems > 0) rows.push([`Payment problems${test}`, `${s.problems} — contact the families`]);
    if (s.noCard > 0) rows.push([`No card yet${test}`, `${s.noCard}${s.noCardStale ? ` (${s.noCardStale} over 7 days)` : ""}`]);
    if (s.trialEnding > 0) rows.push([`Free month ending${test}`, `${s.trialEnding} this week`]);
    rows.push([`On billing${test}`, `${s.onBilling} families · ${money2(s.recurring)}/month`]);
    rows.push([`Tuition this month${test}`, money2(s.monthToDate.total)]);
  }

  // ── Chase (CH:200-235) ──
  rows.push(...(await chaseRows(db, now, deps.mode)));
  if (deps.freePaymentStep && deps.cardStepProblem) {
    rows.push(["⚠️ Card step", `Enroll for Free payment is On, but families cannot add a card: ${deps.cardStepProblem}`]);
  }

  // ── Enrollment (EN:51-73) ──
  const online = eq(registrations.createdVia, "public");
  const started = await one(
    db,
    and(eq(registrations.program, "monthly"), gte(registrations.createdAt, since), or(isNotNull(registrations.familyId), eq(registrations.status, "card_pending")), online),
  );
  const completed = await one(db, and(eq(registrations.status, "enrolled"), isNotNull(registrations.familyId), gte(registrations.updatedAt, since), online));
  const review = await one(db, and(eq(registrations.status, "pending_review"), gte(registrations.createdAt, since)));
  const paid = await one(db, and(eq(registrations.status, "paid"), gte(registrations.updatedAt, since)));
  const waiting = await one(db, eq(registrations.status, "card_pending"));
  if (started) rows.push(["Enrollments started", String(started)]);
  if (completed) rows.push(["Enrollments completed", `${completed} (card confirmed by Stripe)`]);
  if (review) rows.push(["New — pending review", String(review)]);
  if (paid) rows.push(["Summer paid (Stripe)", String(paid)]);
  if (waiting) rows.push(["Waiting for a card", String(waiting)]);

  // ── Footer (N:362-365, BSU:104-111) ──
  const quiet = d !== null && d.count === 0 && regCount === 0;
  let footer = quiet ? "A quiet day — nothing came in." : "Covers the last 24 hours.";
  if ((s.paidToday.count > 0 || s.failedToday > 0) && footer.toLowerCase().includes("quiet")) footer = "Covers the last 24 hours.";

  const title = `📊 Daily Summary — ${dhakaTime(now)}`;
  return { title, rows, footer, html: composeTelegram(title, rows, footer) };
}

/** Builds and queues the one message of the site day. A second run the same Dhaka day queues nothing (dedupe key). */
export async function runDailySummary(db: Queryable, now: Date, deps: SummaryDeps): Promise<{ day: string; outboxIds: number[]; summary: Summary }> {
  const summary = await buildDailySummary(db, now, deps);
  const day = siteYmd(now);
  const outboxIds = await enqueue(db, [{ kind: "telegram", dedupeKey: `daily-summary:${day}`, payload: { template: "daily_summary", html: summary.html } }], now);
  return { day, outboxIds, summary };
}
