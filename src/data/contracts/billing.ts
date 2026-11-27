import type { CourseId } from "../../content/pricing.ts";

/*
 * Family billing (architecture §1.2 families, family_members, payments,
 * arrears). Money in integer cents. One account = one Stripe customer and one
 * subscription. No sibling discount (PRODUCT decision 2). A fully funded
 * child is a scholarship, never a $0 line (spec §7D.3).
 */

/** The live plugin's family statuses (src/db/schema.ts FAMILY_STATUSES). */
export const BILLING_STATUSES = [
  "not_sent",
  "link_sent",
  "free_month",
  "waiting_first_charge",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "canceled",
  "review",
  "bank_verification",
  "ending",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export type HelpLevel = 30 | 45 | 50 | "full";
export type Fund = "zakat" | "special";

export type BillingLine = {
  studentId: string;
  courseId: CourseId;
  daysPerWeek: number;
  /** The published fee for this course and days (pricing.ts). */
  fullCents: number;
  /** Help with fees agreed by the admin, with its fund (null fund: the ledger warns). */
  help: { level: HelpLevel; fund: Fund | null } | null;
  /** What this line costs each month: 0 only for a full scholarship. */
  monthlyCents: number;
};

export type PaymentStatus = "paid" | "failed" | "refunded" | "open";

export type Payment = {
  id: string;
  /** "2026-11": the tuition month. */
  month: string;
  amountCents: number;
  status: PaymentStatus;
  /** ISO date paid, or of the last attempt. */
  on: string;
  attempts: number;
  failureReason: string | null;
};

export type BillingAccount = {
  id: string;
  familyId: string;
  status: BillingStatus;
  lines: BillingLine[];
  /** Sum of the lines. */
  monthlyCents: number;
  /** K1: the 1st of a month (YYYY-MM-DD), or null when nothing is charged. */
  nextChargeOn: string | null;
  method: { kind: "card" | "bank"; brand: string; last4: string } | null;
  payments: Payment[];
  /** Earlier months still owed (arrears). */
  owedMonths: { month: string; amountCents: number }[];
};

export interface BillingRepo {
  forFamily(familyId: string): Promise<BillingAccount | null>;
  all(): Promise<BillingAccount[]>;
}
