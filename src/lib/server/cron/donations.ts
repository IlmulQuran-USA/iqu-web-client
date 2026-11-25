import { createHmac } from "node:crypto";
import { z } from "zod";

/*
 * Donation totals for the 9 PM summary, read from WordPress (architecture,
 * Resolved facts "9 PM daily summary"): Zeffy stays on WordPress, so after the
 * switch the Next cron owns the one message and asks a read-only, signed WP
 * endpoint for counts and totals only — no names, no emails.
 *
 *   GET {IQU_WP_DONATIONS_URL}?since=<unix>&month_start=<unix>
 *   X-IQU-Timestamp: <unix seconds>
 *   X-IQU-Signature: hex HMAC-SHA256(IQU_WP_SUMMARY_SECRET, "<timestamp>\nGET\n<path>?<query>")
 *   200 → { "count": int, "net_cents": int, "donors": int, "month_cents": int }
 *
 * The endpoint itself is a later plugin task, so the client is OFF unless
 * IQU_DONATIONS_SUMMARY=on and both other values are set. Off, misconfigured,
 * slow (5 s), not 200, or an unexpected body: null, and the summary reads
 * "Donations: not available today" instead of skipping (Resolved facts).
 *
 * The figures mirror the plugin's own query (class-iqu-notifier.php:307-341):
 * succeeded payments since `since` (net of refunds, distinct donor emails), and
 * the month to date from the first of the month in UTC (gmdate, :336).
 */

export type Donations = { count: number; netCents: number; donors: number; monthCents: number };

const body = z.object({
  count: z.number().int().min(0),
  net_cents: z.number().int(),
  donors: z.number().int().min(0),
  month_cents: z.number().int(),
});

export type DonationsConfig = { url: string; secret: string };

export function donationsConfig(env: NodeJS.ProcessEnv = process.env): DonationsConfig | null {
  if (env.IQU_DONATIONS_SUMMARY?.trim() !== "on") return null;
  const url = env.IQU_WP_DONATIONS_URL?.trim() ?? "";
  const secret = env.IQU_WP_SUMMARY_SECRET?.trim() ?? "";
  if (!/^https:\/\/[^\s]+$/.test(url) || secret.length < 32) return null;
  return { url, secret };
}

/** The UTC instant of the first of the month (the plugin's gmdate('Y-m-01 00:00:00'), notifier.php:336). */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function signRequest(secret: string, timestamp: number, pathAndQuery: string): string {
  return createHmac("sha256", secret).update(`${timestamp}\nGET\n${pathAndQuery}`).digest("hex");
}

export async function fetchDonations(
  config: DonationsConfig | null,
  window: { since: Date; now: Date },
  fetchImpl: typeof fetch = fetch,
): Promise<Donations | null> {
  if (!config) return null;
  try {
    const url = new URL(config.url);
    url.searchParams.set("since", String(Math.floor(window.since.getTime() / 1000)));
    url.searchParams.set("month_start", String(Math.floor(utcMonthStart(window.now).getTime() / 1000)));
    const ts = Math.floor(window.now.getTime() / 1000);
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json", "x-iqu-timestamp": String(ts), "x-iqu-signature": signRequest(config.secret, ts, `${url.pathname}${url.search}`) },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.status !== 200) return null;
    const parsed = body.safeParse(await res.json());
    if (!parsed.success) return null;
    const d = parsed.data;
    return { count: d.count, netCents: d.net_cents, donors: d.donors, monthCents: d.month_cents };
  } catch {
    return null;
  }
}
