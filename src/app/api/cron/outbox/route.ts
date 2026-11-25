import { outboxAdapters } from "@/lib/server/enroll/config";
import { runCronRoute } from "@/lib/server/cron/run";
import { deliverOutbox } from "@/lib/server/outbox/outbox";

/*
 * Outbox worker (architecture §3 "Scheduling"): delivers up to 50 due Telegram
 * and email rows; a failed send comes back after 1, 5 and 30 minutes, then is
 * dead-lettered (status "dead", body dropped) after 4 attempts; rows older than
 * 48 hours expire unsent. New rows are also sent right after each enrollment and
 * by the job that queued them, so this run only picks up what those missed.
 *
 * Schedule: once a day on the Hobby plan (vercel.json). Every 5 minutes after
 * Vercel Pro — see DEPLOYMENT.md "Cron jobs".
 */

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return runCronRoute(request, async (db, now) => ({ report: { ...(await deliverOutbox(db, await outboxAdapters(db), { now })) } }));
}
