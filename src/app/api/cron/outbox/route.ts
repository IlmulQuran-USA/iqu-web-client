import { timingSafeEqual } from "node:crypto";
import { databaseConfigured, getDb } from "@/db";
import { outboxAdapters } from "@/lib/server/enroll/config";
import { deliverOutbox } from "@/lib/server/outbox/outbox";

/*
 * Outbox delivery and retries (architecture §3 "Scheduling"). Vercel Cron
 * calls GET with "Authorization: Bearer $CRON_SECRET". Each run delivers up
 * to 50 due Telegram and email rows; failed sends come back after 1, 5 and
 * 30 minutes. New rows are also sent right after each enrollment (after()),
 * so this route only picks up what that missed.
 *
 * No schedule is registered yet: a run more often than daily needs the
 * Vercel Pro plan (owner, 24 Nov 2026: Pro before P2). Add it then, e.g.
 * every 5 minutes, under `schedules` in the Vercel project config.
 */

// Reads the request (Authorization), so it is never prerendered (Cache Components).
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
  if (!databaseConfigured()) return Response.json({ ok: false, reason: "DATABASE_URL is not set" }, { status: 503 });
  const db = getDb();
  const report = await deliverOutbox(db, await outboxAdapters(db));
  return Response.json({ ok: true, ...report });
}
