import { and, desc, eq, ne, sql } from "drizzle-orm";
import { families, familyMembers, registrations } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";
import type { RegistrationInsert } from "../../enroll/record.ts";

/*
 * Re-enrollment (port of includes/class-iqu-reenroll.php v3.7.20, read
 * 25 Nov 2026 via Novamira; plan S12).
 *
 * A public submission matches an existing record when the program (the
 * plugin's form_type), the student's name with case, spaces and punctuation
 * ignored, and the email (case-insensitive) are the same (RE:34-56). The
 * newest match wins. Archived records match too and are restored. Siblings
 * (same email, another name) and other programs stay separate.
 *
 *   active   (RE:59-67): monthly with its billing running (a family with a
 *            subscription that is not canceled, the student not Left and their
 *            billing not ended); a Summer place already paid. Weekend never.
 *            → only the family's details are updated (RE:25-29); status,
 *            course, days, fee, payment and billing stay as they are.
 *   inactive → the whole submission replaces the record (same IQU number,
 *            created date and created_via kept, RE:31); Left and billing end
 *            are cleared; monthly: an existing student (no second free month),
 *            Pending review with reason existing_student (RE:70-79), and taken
 *            off a canceled family so a new payment link can be sent (RE:120-131).
 */

/** "Ali  Khan-Rahman" and "ali khan rahman" → "alikhanrahman" (RE:34-38). */
export function normName(first: string, last: string): string {
  return `${first}${last}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export type Match = typeof registrations.$inferSelect;

export async function findMatch(db: Queryable, input: { program: string; email: string; firstName: string; lastName: string }): Promise<Match | null> {
  const email = input.email.trim().toLowerCase();
  const name = normName(input.firstName, input.lastName);
  if (!input.program || !email || !name) return null;
  const rows = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.program, input.program), sql`lower(${registrations.email}) = ${email}`))
    .orderBy(desc(registrations.id));
  return rows.find((r) => normName(r.firstName, r.lastName) === name) ?? null;
}

/** RE:59-67. `mode` is this deployment's Stripe mode: billing in the other mode never counts. */
export async function isActive(db: Queryable, reg: Match, mode: "test" | "live"): Promise<boolean> {
  if (reg.leftAt) return false;
  if (reg.program === "summer_l1" || reg.program === "summer_l2") return reg.paymentStatus === "paid";
  if (reg.program !== "monthly" || reg.status === "cancelled" || reg.billingEndedAt) return false;
  const [family] = await db
    .select({ id: families.id })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(
      and(
        eq(familyMembers.registrationId, reg.id),
        eq(familyMembers.mode, mode),
        sql`${families.stripeSubscriptionId} IS NOT NULL`,
        ne(families.status, "canceled"),
      ),
    )
    .limit(1);
  return Boolean(family);
}

/** RE:25-29: what a details-only update may change, as our columns. */
const DETAIL_COLUMNS = [
  "whatsappE164",
  "guardianName",
  "guardianContactE164",
  "guardianWhatsappE164",
  "dateOfBirth",
  "ageAtSignup",
  "countryOriginCode",
  "countryOriginName",
  "countryResCode",
  "countryResName",
  "preferredDays",
  "timeStart",
  "timeEnd",
  "timeZone",
  "timeZoneLabel",
  "timeSlotText",
  "sessionMinutes",
  "languages",
  "languagesOther",
  "teacherPref",
  "memorized",
  "quranLevel",
  "referral",
  "referralOther",
  "waUpdates",
  "whatsappGroup",
  "futureUpdates",
  "marketingConsent",
] as const satisfies readonly (keyof RegistrationInsert)[];

export function detailsOnly(fields: RegistrationInsert): Partial<RegistrationInsert> {
  const out: Partial<RegistrationInsert> = {};
  for (const key of DETAIL_COLUMNS) {
    if (fields[key] !== undefined) (out as Record<string, unknown>)[key] = fields[key];
  }
  return out;
}

/** RE:31: never taken from a submission when updating. */
export function withoutKept(fields: RegistrationInsert): RegistrationInsert {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose
  const { id, createdAt, createdVia, ...rest } = fields;
  return rest as RegistrationInsert;
}
