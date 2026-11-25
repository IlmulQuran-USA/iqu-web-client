import { runLedger } from "@/lib/server/cron/ledger";
import { runCronRoute } from "@/lib/server/cron/run";
import { readSettings } from "@/lib/server/enroll/settings";
import { expectedMode } from "@/lib/server/stripe-mode";

/*
 * Zakat and Special discount ledger, daily (src/lib/server/cron/ledger.ts;
 * plugin class-iqu-discount-ledger.php:257-306). Writes the current Asia/Dhaka
 * month's row of every active student with a reduction; safe to run any number
 * of times. Scheduled at 18:30 UTC = 00:30 in Dhaka, so the new month's rows
 * are written on the 1st.
 */

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return runCronRoute(request, async (db, now) => {
    const settings = await readSettings(db);
    return { report: await runLedger(db, now, { mode: expectedMode(), billingDay: settings.billingDay }) };
  });
}
