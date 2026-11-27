import type { CourseId } from "../../content/pricing.ts";

/*
 * Classes and attendance (spec §7C). Attendance is measured, never entered:
 * a session's status comes from the overlap of teacher and student in the
 * Zoom meeting, against thresholds read from settings (never hard-coded in a
 * page). The six statuses are the only attendance vocabulary.
 */

export const ATTENDANCE_STATUSES = [
  "present",
  "partial",
  "technical-issue",
  "student-absent",
  "teacher-no-show",
  "class-not-held",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Calibrated after launch (spec §7C.2); admin settings in Batch 2. */
export type Thresholds = {
  /** Overlap at or above this share of the scheduled length: Present. */
  presentPercent: number;
  /** At or above this (and below Present): Partial; below it but above zero: Technical issue. */
  partialPercent: number;
  /** Minutes after the start before the admin is alerted about a teacher no-show. */
  noShowAlertMinutes: number;
};

export type SessionState = "upcoming" | "in_progress" | "ended";

export type ClassSession = {
  id: string;
  studentId: string;
  teacherId: string;
  /** null for the Weekend program (its own curriculum). */
  courseId: CourseId | null;
  /** Start, ISO 8601 UTC. */
  startsAt: string;
  /** Scheduled length. */
  minutes: number;
  kind: "regular" | "makeup";
  state: SessionState;
  /** null until the class has ended. */
  status: AttendanceStatus | null;
  /**
   * Teacher and student together in the meeting, in minutes (Zoom). Admin
   * and teacher views only: parents see the status and the class length
   * (owner, 27 Nov 2026).
   */
  overlapMinutes: number | null;
};

export interface ScheduleRepo {
  thresholds(): Promise<Thresholds>;
  /** Sessions starting in [from, to), oldest first. */
  forStudent(studentId: string, from: Date, to: Date): Promise<ClassSession[]>;
  forTeacher(teacherId: string, from: Date, to: Date): Promise<ClassSession[]>;
  between(from: Date, to: Date): Promise<ClassSession[]>;
}

/** The status the overlap gives, with these thresholds (spec §7C.2). Pure: every adapter uses it. */
export function statusFromOverlap(
  facts: { teacherJoined: boolean; studentJoined: boolean; overlapMinutes: number; scheduledMinutes: number },
  t: Thresholds,
): AttendanceStatus {
  if (!facts.teacherJoined && !facts.studentJoined) return "class-not-held";
  if (facts.overlapMinutes <= 0) return facts.teacherJoined ? "student-absent" : "teacher-no-show";
  const percent = (facts.overlapMinutes / facts.scheduledMinutes) * 100;
  if (percent >= t.presentPercent) return "present";
  if (percent >= t.partialPercent) return "partial";
  return "technical-issue";
}
