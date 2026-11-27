import type { CourseId } from "../../content/pricing.ts";
import type { Role } from "../../lib/auth/session.ts";

/*
 * People: accounts, families, students, teachers (plan §1.1 identity.ts and
 * people.ts, merged: they always travel together). Times are IANA zones;
 * every display adds the year-round label (ET, CT, MT, PT, AT).
 */

export type Account = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  /** parent and student accounts: the family they belong to. */
  familyId: string | null;
  /** student accounts: the adult learner's own student record. */
  studentId: string | null;
  /** teacher accounts. */
  teacherId: string | null;
};

export type Teacher = {
  id: string;
  /** With title (Hafez, Hafezah, Mawlana, Mufti), as written everywhere. */
  name: string;
  gender: "male" | "female";
  zone: "Asia/Dhaka";
  courses: CourseId[];
  /** "setup": added, but no Zoom account linked and no students yet. */
  status: "active" | "setup";
  zoomLinked: boolean;
};

export type Program = "monthly" | "weekend" | "summer";

export type StudentStatus = "active" | "archived" | "left";

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  /** Age today; adult learners are 18 or older. */
  age: number;
  adult: boolean;
  familyId: string;
  program: Program;
  /** Monthly courses only. */
  courseId: CourseId | null;
  daysPerWeek: number;
  minutes: 30 | 40 | 50 | 60;
  teacherId: string | null;
  /** The student's own zone (IANA). */
  zone: string;
  status: StudentStatus;
  /** Weekend groups ("Weekend group A"). */
  group: string | null;
};

export type Family = {
  id: string;
  guardianName: string;
  email: string;
  city: string;
  region: string;
  country: "US" | "CA";
  zone: string;
  studentIds: string[];
};

export interface PeopleRepo {
  account(id: string): Promise<Account | null>;
  accountByEmail(email: string): Promise<Account | null>;
  family(id: string): Promise<Family | null>;
  families(): Promise<Family[]>;
  student(id: string): Promise<Student | null>;
  students(): Promise<Student[]>;
  studentsOfFamily(familyId: string): Promise<Student[]>;
  studentsOfTeacher(teacherId: string): Promise<Student[]>;
  teacher(id: string): Promise<Teacher | null>;
  teachers(): Promise<Teacher[]>;
}
