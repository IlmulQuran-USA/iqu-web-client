import { validateContact, topicLabel, type ContactErrors, type ContactInput } from "../contact/schema.ts";
import type { AnyDb } from "../../db/types.ts";
import { contactEmail } from "./enroll/messages.ts";
import { gmailConfig } from "./outbox/gmail.ts";
import { enqueue } from "./outbox/outbox.ts";
import { hashKey } from "./keys.ts";
import { bump, LIMITS, under } from "./rate.ts";

/*
 * /contact form (spec §7.15; plan approved, answers 1–4 yes). The message goes
 * to the team inbox through the P1 Gmail API mailer (Resolved facts, 24 Nov
 * 2026: not Brevo), as an outbox row delivered right after the response and
 * retried by /api/cron/outbox. Reply-To is the visitor, so the team answers
 * them directly.
 *
 * - Open only when the mailer, the database and the hash secret are all set;
 *   otherwise the page shows "Message form opens soon." and no form.
 * - Honeypot: a bot gets the same thank-you; nothing is saved or sent.
 * - Rate limits: 5 per IP and 3 per email address an hour, counted on success,
 *   keyed by HMAC only (P1 keys.ts; an IP or an email never reaches the database).
 * - A double click or a resend of the same form (same submit id) queues one email.
 * - Outside production the P1 guard applies: the email reaches the team inbox
 *   only if it is on EMAIL_ALLOWLIST; otherwise it is logged and skipped.
 */

export type ContactConfig = { hashSecret: string; teamInbox: string };

export function contactConfig(env: NodeJS.ProcessEnv = process.env): ContactConfig | null {
  const gmail = gmailConfig(env);
  const hashSecret = env.IQU_HASH_SECRET?.trim() ?? "";
  if (!gmail || !env.DATABASE_URL?.trim() || hashSecret.length < 32) return null;
  return { hashSecret, teamInbox: gmail.sender };
}

export type ContactResult =
  | { status: "ok"; outboxIds: number[] }
  | { status: "invalid"; errors: ContactErrors }
  | { status: "limited" }
  | { status: "error"; code: "bad_submit_id" };

export async function submitContactCore(
  db: AnyDb,
  input: { fields: ContactInput; honeypot: string; submitId: string; ip: string },
  deps: ContactConfig & { now: Date },
): Promise<ContactResult> {
  if (input.honeypot !== "") return { status: "ok", outboxIds: [] };
  const errors = validateContact(input.fields);
  if (Object.keys(errors).length) return { status: "invalid", errors };
  if (!/^[A-Za-z0-9-]{16,64}$/.test(input.submitId)) return { status: "error", code: "bad_submit_id" };

  const f = {
    name: input.fields.name.trim(),
    email: input.fields.email.trim(),
    phone: input.fields.phone.trim(),
    topic: topicLabel(input.fields.topic),
    message: input.fields.message.trim(),
  };
  const ipKey = input.ip ? hashKey(deps.hashSecret, "contactip", input.ip) : null;
  const emailKey = hashKey(deps.hashSecret, "contactemail", f.email.toLowerCase());

  return db.transaction(async (tx): Promise<ContactResult> => {
    // The same form sent twice: the first email stands, nothing is counted again.
    const ids = await enqueue(
      tx,
      [{ kind: "email", dedupeKey: `contact:${input.submitId}`, payload: { template: "contact_form", replyTo: f.email, ...contactEmail(deps.teamInbox, f, deps.now) } }],
      deps.now,
    );
    if (!ids.length) return { status: "ok", outboxIds: [] };
    if ((ipKey && !(await under(tx, ipKey, LIMITS.contactIp, deps.now))) || !(await under(tx, emailKey, LIMITS.contactEmail, deps.now))) {
      // Over the limit: undo the queued email with the transaction.
      throw new Limited();
    }
    if (ipKey) await bump(tx, ipKey, deps.now);
    await bump(tx, emailKey, deps.now);
    return { status: "ok", outboxIds: ids };
  }).catch((error: unknown): ContactResult => {
    if (error instanceof Limited) return { status: "limited" };
    throw error;
  });
}

class Limited extends Error {}
