import { runCardReminders } from "@/lib/server/cron/reminders";
import { runCronRoute } from "@/lib/server/cron/run";
import { expectedMode } from "@/lib/server/stripe-mode";

/*
 * Card reminders at 24 h and 72 h and the 7-day expiry of unfinished card
 * steps (src/lib/server/cron/reminders.ts; plugin class-iqu-enrollment.php:343-398).
 *
 * The plugin runs this hourly. On the Hobby plan it runs once a day
 * (vercel.json), so a reminder goes out between 24 and 48 hours (72 and 96)
 * after the enrollment; the rules are the same. Hourly after Vercel Pro —
 * DEPLOYMENT.md "Cron jobs".
 *
 * The "Finish enrollment" link is the family's Stripe link, which P2 creates.
 * Until then no link exists, so no reminder is claimed or sent (`noLink`).
 */

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return runCronRoute(request, async (db, now) => {
    const { outboxIds, ...report } = await runCardReminders(db, now, { mode: expectedMode(), cardLink: () => null });
    return { report, outboxIds };
  });
}
