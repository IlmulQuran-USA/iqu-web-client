import { teachApplications } from "../../db/schema.ts";
import type { AnyDb } from "../../db/types.ts";
import { COURSE_OPTIONS, GENDERS, LANGUAGES, QUALIFICATIONS, labelOf, labelsOf, validateTeach, type TeachErrors, type TeachInput } from "../teach/schema.ts";
import { contactConfig, type ContactConfig } from "./contact.ts";
import { teachApplicationEmail, teachApplicationTelegram, type TeachSummary } from "./enroll/messages.ts";
import { enqueue } from "./outbox/outbox.ts";
import { hashKey } from "./keys.ts";
import { bump, LIMITS, under } from "./rate.ts";

/*
 * /teach application (spec §7.16; owner, 27 Nov 2026). Saved to
 * teach_applications, then the team hears through the P1 outbox: an email to
 * the team inbox (Gmail API mailer, Reply-To the applicant) and a Telegram
 * notice to the team chat. Both are delivered right after the response and
 * retried by /api/cron/outbox.
 *
 * - Open only when the mailer, the database and the hash secret are all set
 *   (the same as /contact); otherwise the page shows "Applications open soon"
 *   and no form, so nothing is ever pretended to be sent.
 * - Honeypot: a bot gets the same thank-you; nothing is saved or sent.
 * - Rate limits: 3 per IP and 2 per email address an hour, counted on success,
 *   keyed by HMAC only (an IP or an email never reaches rate_limits).
 * - The same form sent twice (same submit id): one row, one email, one notice.
 * - Outside production the P1 guards apply: email only to EMAIL_ALLOWLIST,
 *   Telegram only to the test chat.
 */

export type TeachConfig = ContactConfig;

/** The same requirements as /contact: the Gmail mailer, DATABASE_URL and IQU_HASH_SECRET. */
export const teachConfig = (env: NodeJS.ProcessEnv = process.env): TeachConfig | null => contactConfig(env);

export type TeachResult =
  | { status: "ok"; applicationId: number | null; outboxIds: number[] }
  | { status: "invalid"; errors: TeachErrors }
  | { status: "limited" }
  | { status: "error"; code: "bad_submit_id" };

class Limited extends Error {}

export async function submitTeachCore(
  db: AnyDb,
  input: { fields: TeachInput; honeypot: string; submitId: string; ip: string },
  deps: TeachConfig & { now: Date },
): Promise<TeachResult> {
  if (input.honeypot !== "") return { status: "ok", applicationId: null, outboxIds: [] };
  const errors = validateTeach(input.fields);
  if (Object.keys(errors).length) return { status: "invalid", errors };
  if (!/^[A-Za-z0-9-]{16,64}$/.test(input.submitId)) return { status: "error", code: "bad_submit_id" };

  const f = input.fields;
  const clean = (s: string) => s.trim();
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  const qualifications = [...new Set(f.qualifications)];
  const row = {
    submitId: input.submitId,
    name: clean(f.name),
    email: clean(f.email),
    phone: clean(f.phone),
    country: clean(f.country),
    gender: f.gender,
    courses: [...new Set(f.courses)],
    languages: [...new Set(f.languages)],
    qualifications,
    qualificationOther: qualifications.includes("other") ? opt(f.qualificationOther) : null,
    ijazah: f.ijazah === "yes",
    ijazahDetail: f.ijazah === "yes" ? opt(f.ijazahDetail) : null,
    experience: clean(f.experience),
    availability: clean(f.availability),
    timeZone: clean(f.timeZone),
    sampleUrl: opt(f.sampleUrl),
    referees: opt(f.references),
    message: opt(f.message),
  };
  const ipKey = input.ip ? hashKey(deps.hashSecret, "teachip", input.ip) : null;
  const emailKey = hashKey(deps.hashSecret, "teachemail", row.email.toLowerCase());

  return db
    .transaction(async (tx): Promise<TeachResult> => {
      // The same form sent twice: the first application stands, nothing is counted again.
      const [saved] = await tx.insert(teachApplications).values(row).onConflictDoNothing({ target: teachApplications.submitId }).returning({ id: teachApplications.id });
      if (!saved) return { status: "ok", applicationId: null, outboxIds: [] };
      if ((ipKey && !(await under(tx, ipKey, LIMITS.teachIp, deps.now))) || !(await under(tx, emailKey, LIMITS.teachEmail, deps.now))) {
        // Over the limit: undo the row (and anything queued) with the transaction.
        throw new Limited();
      }
      const summary: TeachSummary = {
        id: saved.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        country: row.country,
        gender: labelOf(GENDERS, row.gender),
        courses: labelsOf(COURSE_OPTIONS, row.courses),
        languages: labelsOf(LANGUAGES, row.languages),
        qualifications: [labelsOf(QUALIFICATIONS, row.qualifications.filter((q) => q !== "other")), row.qualificationOther ? `Other: ${row.qualificationOther}` : ""].filter(Boolean).join("; "),
        ijazah: row.ijazah ? `Yes — ${row.ijazahDetail}` : "No",
        experience: row.experience,
        availability: row.availability,
        timeZone: row.timeZone,
        sampleUrl: row.sampleUrl ?? "",
        references: row.referees ?? "",
        message: row.message ?? "",
      };
      const outboxIds = await enqueue(
        tx,
        [
          { kind: "email", dedupeKey: `teach:${input.submitId}:email`, payload: { template: "teach_application", replyTo: row.email, ...teachApplicationEmail(deps.teamInbox, summary, deps.now) } },
          { kind: "telegram", dedupeKey: `teach:${input.submitId}:telegram`, payload: { template: "teach_application", html: teachApplicationTelegram(summary, deps.now) } },
        ],
        deps.now,
      );
      if (ipKey) await bump(tx, ipKey, deps.now);
      await bump(tx, emailKey, deps.now);
      return { status: "ok", applicationId: saved.id, outboxIds };
    })
    .catch((error: unknown): TeachResult => {
      if (error instanceof Limited) return { status: "limited" };
      throw error;
    });
}
