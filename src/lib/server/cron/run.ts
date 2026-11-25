import { databaseConfigured, getDb, type Db } from "../../../db/index.ts";
import { outboxAdapters } from "../enroll/config.ts";
import { deliverOutbox, type DeliveryReport } from "../outbox/outbox.ts";
import { cronAuthorized } from "./auth.ts";

/*
 * Shared by every /api/cron/* route. Vercel Cron calls GET with
 * "Authorization: Bearer $CRON_SECRET" (architecture §3 "Scheduling").
 *
 * - The secret is checked in constant time (auth.ts); a short or missing one refuses all.
 * - Without DATABASE_URL a job does nothing and says so (503).
 * - Every job is idempotent (see each job), so a retried or doubled run is safe.
 * - What a job queues (Telegram, email) is delivered in the same request:
 *   on the Hobby plan there is no frequent outbox run to pick it up.
 */

export type JobResult = { report: Record<string, unknown>; outboxIds?: number[] };

export async function runCronRoute(request: Request, job: (db: Db, now: Date) => Promise<JobResult>): Promise<Response> {
  if (!cronAuthorized(request.headers.get("authorization"))) return Response.json({ ok: false }, { status: 401 });
  if (!databaseConfigured()) return Response.json({ ok: false, reason: "DATABASE_URL is not set" }, { status: 503 });
  const db = getDb();
  const now = new Date();
  const { report, outboxIds } = await job(db, now);
  let delivery: DeliveryReport | null = null;
  if (outboxIds?.length) delivery = await deliverOutbox(db, await outboxAdapters(db), { ids: outboxIds, now });
  return Response.json({ ok: true, ...report, ...(delivery ? { delivery } : {}) });
}
