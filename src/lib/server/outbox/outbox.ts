import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { outbox } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";
import { sendGmail, type GmailConfig } from "./gmail.ts";
import { sendTelegram, type SendResult, type TelegramConfig } from "./telegram.ts";

/*
 * The notifications outbox (architecture §3, §0.4). Side effects are written
 * as rows in the same transaction as the enrollment, then delivered after
 * the response (and by the cron route for retries), so a slow or failing
 * Telegram or Gmail never blocks a family, and nothing is sent twice:
 *
 * - dedupe: `dedupe_key` is unique; enqueueing the same key again is a no-op.
 * - claim: due rows are leased with SELECT … FOR UPDATE SKIP LOCKED and their
 *   next attempt pushed 5 minutes ahead, so two workers never take the same row.
 * - retry: a failed send is tried again after 1 min, 5 min and 30 min (4
 *   attempts in all, the plugin's "retry 3×"), then marked dead.
 * - idle adapter (env not set): the row waits, attempts unchanged.
 * - refused by a staging guard: "skipped", logged, never sent.
 * - stale: a row older than 48 h is not sent any more (dead, "expired"),
 *   so connecting an adapter later never floods the chat with old news.
 * - privacy: once a row is finished its body is dropped (only the template
 *   name is kept).
 *
 * Meta rows are only enqueued (event id + registration id). They are
 * delivered with the consent banner, in a later phase: this worker leaves them.
 */

export type TelegramPayload = { template: string; html: string; chatId?: string };
export type EmailPayload = { template: string; to: string; subject: string; html: string; text: string };
export type MetaPayload = { template: "meta_lead"; event: "Lead"; eventId: string; registrationId: number; contentName: string; valueCents: number };

export type OutboxRow =
  | { kind: "telegram"; dedupeKey: string; payload: TelegramPayload }
  | { kind: "email"; dedupeKey: string; payload: EmailPayload }
  | { kind: "meta"; dedupeKey: string; payload: MetaPayload };

/** Adds rows; a dedupe key already present is skipped. Returns the ids of the rows added now. */
export async function enqueue(db: Queryable, rows: OutboxRow[], now: Date): Promise<number[]> {
  if (!rows.length) return [];
  const added = await db
    .insert(outbox)
    .values(rows.map((r) => ({ kind: r.kind, dedupeKey: r.dedupeKey, payload: r.payload, nextAttemptAt: now, createdAt: now })))
    .onConflictDoNothing({ target: outbox.dedupeKey })
    .returning({ id: outbox.id });
  return added.map((r) => r.id);
}

export const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];
const LEASE_MS = 5 * 60_000;
const IDLE_WAIT_MS = 15 * 60_000;
export const MAX_AGE_MS = 48 * 60 * 60_000;

export type Adapters = {
  telegram: TelegramConfig | null;
  gmail: GmailConfig | null;
  /** The From name on emails. */
  fromName: string;
  fetchImpl?: typeof fetch;
};

export type DeliveryReport = { sent: number; skipped: number; idle: number; retrying: number; failed: number; dead: number };

const DELIVERED_KINDS = ["telegram", "email"] as const;

async function sendOne(row: typeof outbox.$inferSelect, a: Adapters): Promise<SendResult> {
  if (row.kind === "telegram") {
    const p = row.payload as TelegramPayload;
    return sendTelegram(a.telegram, { chatId: p.chatId, html: p.html }, a.fetchImpl);
  }
  const p = row.payload as EmailPayload;
  return sendGmail(a.gmail, { to: p.to, subject: p.subject, html: p.html, text: p.text, fromName: a.fromName }, a.fetchImpl);
}

const redacted = (payload: unknown) => ({ template: (payload as { template?: string })?.template ?? "unknown", redacted: true });

/** Deliver due Telegram and email rows (all of them, or only `ids`). Never throws for a send failure. */
export async function deliverOutbox(db: Queryable, a: Adapters, opts: { now?: Date; ids?: number[]; limit?: number } = {}): Promise<DeliveryReport> {
  const now = opts.now ?? new Date();
  const report: DeliveryReport = { sent: 0, skipped: 0, idle: 0, retrying: 0, failed: 0, dead: 0 };
  if (opts.ids && opts.ids.length === 0) return report;

  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: outbox.id })
      .from(outbox)
      .where(
        and(
          eq(outbox.status, "pending"),
          inArray(outbox.kind, [...DELIVERED_KINDS]),
          lte(outbox.nextAttemptAt, now),
          opts.ids ? inArray(outbox.id, opts.ids) : undefined,
        ),
      )
      .orderBy(asc(outbox.id))
      .limit(opts.limit ?? 50)
      .for("update", { skipLocked: true });
    if (!due.length) return [];
    return tx
      .update(outbox)
      .set({ nextAttemptAt: new Date(now.getTime() + LEASE_MS) })
      .where(inArray(outbox.id, due.map((d) => d.id)))
      .returning();
  });

  const idleLogged = new Set<string>();
  for (const row of claimed) {
    if (now.getTime() - row.createdAt.getTime() > MAX_AGE_MS) {
      await db.update(outbox).set({ status: "dead", lastError: "expired before delivery (older than 48 h)", payload: redacted(row.payload) }).where(eq(outbox.id, row.id));
      report.dead += 1;
      continue;
    }
    const result = await sendOne(row, a);
    switch (result.kind) {
      case "sent":
        await db
          .update(outbox)
          .set({ status: "sent", sentAt: now, attempts: row.attempts + 1, lastError: null, payload: redacted(row.payload) })
          .where(eq(outbox.id, row.id));
        report.sent += 1;
        break;
      case "idle":
        if (!idleLogged.has(row.kind)) {
          console.warn(`[outbox] ${result.reason}: ${row.kind} rows wait.`);
          idleLogged.add(row.kind);
        }
        await db.update(outbox).set({ lastError: result.reason, nextAttemptAt: new Date(now.getTime() + IDLE_WAIT_MS) }).where(eq(outbox.id, row.id));
        report.idle += 1;
        break;
      case "refused":
        // Logged without the recipient or the message: only the row and the reason.
        console.warn(`[outbox] row ${row.id} (${row.kind}) not sent: ${result.reason}.`);
        await db.update(outbox).set({ status: "skipped", lastError: result.reason, payload: redacted(row.payload) }).where(eq(outbox.id, row.id));
        report.skipped += 1;
        break;
      case "failed": {
        const attempts = row.attempts + 1;
        if (!result.retry) {
          await db.update(outbox).set({ status: "failed", attempts, lastError: result.reason }).where(eq(outbox.id, row.id));
          console.error(`[outbox] row ${row.id} (${row.kind}) failed: ${result.reason}.`);
          report.failed += 1;
        } else if (attempts >= MAX_ATTEMPTS) {
          await db.update(outbox).set({ status: "dead", attempts, lastError: result.reason }).where(eq(outbox.id, row.id));
          console.error(`[outbox] row ${row.id} (${row.kind}) gave up after ${attempts} attempts: ${result.reason}.`);
          report.dead += 1;
        } else {
          await db
            .update(outbox)
            .set({ attempts, lastError: result.reason, nextAttemptAt: new Date(now.getTime() + BACKOFF_MS[attempts - 1]) })
            .where(eq(outbox.id, row.id));
          report.retrying += 1;
        }
        break;
      }
    }
  }
  return report;
}
