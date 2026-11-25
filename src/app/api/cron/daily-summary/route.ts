import { donationsConfig, fetchDonations } from "@/lib/server/cron/donations";
import { runCronRoute } from "@/lib/server/cron/run";
import { runDailySummary } from "@/lib/server/cron/summary";
import { enrollConfig } from "@/lib/server/enroll/config";
import { readSettings } from "@/lib/server/enroll/settings";
import { checkStripeEnv, expectedMode } from "@/lib/server/stripe-mode";

/*
 * The 9 PM Asia/Dhaka daily summary: one Telegram message with registrations,
 * tuition and donations (src/lib/server/cron/summary.ts). 15:00 UTC = 21:00
 * Dhaka (no daylight saving). A second run the same Dhaka day sends nothing.
 *
 * Outside production the message goes only to the test chat (P1 Telegram
 * guard in the outbox). Before the switch, WordPress still sends its own
 * summary to the team chat; the two never share a chat.
 */

export const maxDuration = 60;

/** Why families cannot add a card right now, in plain words ('' when they can). */
function cardStepProblem(): string {
  const stripe = checkStripeEnv({
    siteEnv: process.env.NEXT_PUBLIC_SITE_ENV,
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  if (!stripe.ok) return stripe.reason;
  return enrollConfig()?.cardStepLive ? "" : "the Stripe card step is not connected yet.";
}

export async function GET(request: Request): Promise<Response> {
  return runCronRoute(request, async (db, now) => {
    const settings = await readSettings(db);
    const donations = await fetchDonations(donationsConfig(), { since: new Date(now.getTime() - 86_400_000), now });
    const { day, outboxIds, summary } = await runDailySummary(db, now, {
      mode: expectedMode(),
      donations,
      cardStepProblem: cardStepProblem(),
      freePaymentStep: settings.freePaymentStep,
    });
    return { report: { day, queued: outboxIds.length > 0, lines: summary.rows.length, donations: donations ? "ok" : "not available" }, outboxIds };
  });
}
