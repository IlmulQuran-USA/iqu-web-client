import type { CourseId } from "../../content/pricing.ts";

/*
 * Enrollments as the admin sees them (architecture §1.2 registrations,
 * review_reasons), and the enrollment write path the public form uses
 * (src/app/actions/enroll.ts). Batch 1 carries the shape the admin lists
 * need; the full record arrives with the admin screens (Batch 2).
 */

export const REGISTRATION_STATUSES = [
  "pending",
  "card_pending",
  "pending_review",
  "enrolled",
  "paid",
  "contacted",
  "confirmed",
  "cancelled",
  "expired",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export type RegistrationProgram = "monthly" | "summer_l1" | "summer_l2" | "weekend_new" | "weekend_existing";

export type Registration = {
  /** "IQU-9001". Mock references start at 9001, outside the live range. */
  reference: string;
  studentId: string | null;
  studentName: string;
  program: RegistrationProgram;
  courseId: CourseId | null;
  status: RegistrationStatus;
  createdVia: "public" | "admin" | "import";
  /** ISO 8601 UTC. */
  createdAt: string;
  openReviewReasons: string[];
  archived: boolean;
};

export interface RegistrationsRepo {
  list(): Promise<Registration[]>;
}

/** The answer of an enrollment submit, as the form understands it (src/app/actions/enroll.ts SubmitResult). */
export type EnrollmentResult =
  | { status: "ok"; href: string; external: false }
  | { status: "invalid"; step: string; errors: Record<string, string>; message: string }
  | { status: "error"; code: string; message: string };

export interface EnrollmentWriter {
  /**
   * Validates the draft exactly as the live path does and answers with the
   * next page. The mock adapter saves nothing, sends nothing and charges
   * nothing.
   */
  submit(rawDraft: unknown, now: Date): Promise<EnrollmentResult>;
}
