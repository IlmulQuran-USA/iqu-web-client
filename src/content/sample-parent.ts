import { courseById, monthlyFee, usd, type CourseId } from "./pricing";
import { instructors } from "./instructors";
import type { Instructor } from "./types";

/*
 * Sample data for the parent dashboard and the sample monthly report
 * (/preview/parent-dashboard, /preview/sample-report; owner, 21 Nov 2026).
 *
 * Status "sample": shown for admin review, to be replaced by the portal's
 * real data. `npm run content:check` lists it under "Sample content to
 * replace". The family and the children are invented; courses, teachers and
 * fees are real (src/content). Attendance statuses are the six of spec
 * §7C.2 and are given here as system facts, never derived from hard-coded
 * thresholds (CLAUDE.md §4). Times are in the family's zone, labelled with
 * its year-round name.
 */

export type AttendanceStatus =
  | "present"
  | "partial"
  | "technical-issue"
  | "student-absent"
  | "teacher-no-show"
  | "class-not-held";

export type ClassRecord = {
  /** "Mon 16 Nov" */
  day: string;
  time: string;
  /** null for a class that has not happened yet. */
  status: AttendanceStatus | null;
  /** Verified overlap from Zoom (spec §7C), null when not measured yet. */
  verifiedMinutes: number | null;
  scheduledMinutes: number;
};

export type Child = {
  id: string;
  name: string;
  age: number;
  courseId: CourseId;
  daysPerWeek: number;
  minutes: 30 | 45;
  teacher: Instructor;
  nextClass: { date: string; time: string };
  week: ClassRecord[];
  month: { label: string; attended: number; scheduled: number; excused: number };
  progress:
    | { kind: "hifz"; juzDone: number[]; juzCurrent: number; sabaq: string; sabqi: string; manzil: string }
    | { kind: "classPlan"; currentClass: number; totalClasses: number; focus: string; nextCheckpoint: string };
  note: { date: string; text: string };
};

const teacher = (id: string): Instructor => {
  const person = instructors.find((p) => p.id === id);
  if (!person) throw new Error(`Unknown instructor ${id}`);
  return person;
};

const ZONE = "CT";

const children: Child[] = [
  {
    id: "yusuf",
    name: "Yusuf",
    age: 9,
    courseId: "quran-hifz",
    daysPerWeek: 5,
    minutes: 45,
    teacher: teacher("mawlana-mouinul-islam"),
    nextClass: { date: "Mon 23 Nov 2026", time: `5:30 PM ${ZONE}` },
    week: [
      { day: "Mon 16 Nov", time: `5:30 PM ${ZONE}`, status: "present", verifiedMinutes: 44, scheduledMinutes: 45 },
      { day: "Tue 17 Nov", time: `5:30 PM ${ZONE}`, status: "present", verifiedMinutes: 45, scheduledMinutes: 45 },
      { day: "Wed 18 Nov", time: `5:30 PM ${ZONE}`, status: "partial", verifiedMinutes: 26, scheduledMinutes: 45 },
      { day: "Thu 19 Nov", time: `5:30 PM ${ZONE}`, status: "technical-issue", verifiedMinutes: 9, scheduledMinutes: 45 },
      { day: "Fri 20 Nov", time: `5:30 PM ${ZONE}`, status: "present", verifiedMinutes: 43, scheduledMinutes: 45 },
    ],
    month: { label: "November", attended: 13, scheduled: 14, excused: 1 },
    progress: {
      kind: "hifz",
      juzDone: [30],
      juzCurrent: 29,
      sabaq: "Al-Mulk 67:13–18",
      sabqi: "Al-Mulk 67:1–12",
      manzil: "Juz 30: An-Naba to Al-Inshiqaq",
    },
    note: {
      date: "Fri 20 Nov 2026",
      text: "Yusuf recited today’s Sabaq with only one small mistake. Please listen to Al-Mulk 67:13–18 once at home before Monday’s class.",
    },
  },
  {
    id: "maryam",
    name: "Maryam",
    age: 6,
    courseId: "noorani-qaidah",
    daysPerWeek: 3,
    minutes: 30,
    teacher: teacher("shifa-jalal"),
    nextClass: { date: "Mon 23 Nov 2026", time: `4:30 PM ${ZONE}` },
    week: [
      { day: "Mon 16 Nov", time: `4:30 PM ${ZONE}`, status: "present", verifiedMinutes: 30, scheduledMinutes: 30 },
      { day: "Wed 18 Nov", time: `4:30 PM ${ZONE}`, status: "student-absent", verifiedMinutes: 0, scheduledMinutes: 30 },
      { day: "Fri 20 Nov", time: `4:30 PM ${ZONE}`, status: "present", verifiedMinutes: 29, scheduledMinutes: 30 },
    ],
    month: { label: "November", attended: 8, scheduled: 9, excused: 0 },
    progress: {
      kind: "classPlan",
      currentClass: 23,
      totalClasses: 48,
      focus: "Madd letters and recitation rules such as Tanween, Izhar and Ikhfa",
      nextCheckpoint: "Revision and exam in class 30",
    },
    note: {
      date: "Fri 20 Nov 2026",
      text: "Maryam now reads Tanween clearly. We will practise Izhar together next week, in sha’ Allah.",
    },
  },
];

/** The family's monthly fee for each child, from ./pricing. */
const fees = children.map((c) => ({ child: c.name, course: courseById(c.courseId).label, fee: monthlyFee(courseById(c.courseId), c.daysPerWeek) }));

export const parentDashboardSample = {
  status: "sample",
  text: "Sample family (Amina, with Yusuf and Maryam) for the parent dashboard preview.",
  parentName: "Amina",
  zone: ZONE,
  today: "Sat 21 Nov 2026",
  children,
  billing: {
    nextDate: "4 Dec 2026",
    lines: fees.map((f) => ({ ...f, feeLabel: usd(f.fee) })),
    total: usd(fees.reduce((sum, f) => sum + f.fee, 0)),
    method: "Visa ending 4242",
    lastPayment: "Paid 4 Nov 2026",
  },
} as const;

export function childById(id: string | undefined): Child | undefined {
  return children.find((c) => c.id === id);
}

/** The sample monthly report (/preview/sample-report): Yusuf, October 2026. */
export const sampleReport = {
  status: "sample",
  text: "Sample monthly progress report (Yusuf, Qur’an Hifz, October 2026).",
  child: children[0],
  month: "October 2026",
  issued: "1 Nov 2026",
  attendance: {
    scheduled: 22,
    present: 19,
    partial: 2,
    technicalIssue: 1,
    studentAbsent: 0,
    teacherNoShow: 0,
    classNotHeld: 0,
    verifiedMinutes: 925,
    scheduledMinutes: 990,
  },
  lessons: [
    { week: "Week 1 (1–3 Oct)", sabaq: "Al-Mulk 67:1–3", sabqi: "An-Naba 78:31–40", manzil: "Juz 30, first half" },
    { week: "Week 2 (6–10 Oct)", sabaq: "Al-Mulk 67:4–6", sabqi: "Al-Mulk 67:1–3", manzil: "Juz 30, second half" },
    { week: "Week 3 (13–17 Oct)", sabaq: "Al-Mulk 67:7–9", sabqi: "Al-Mulk 67:1–6", manzil: "Juz 30, first half" },
    { week: "Week 4 (20–24 Oct)", sabaq: "Al-Mulk 67:10–12", sabqi: "Al-Mulk 67:1–9", manzil: "Juz 30, second half" },
    { week: "Week 5 (27–31 Oct)", sabaq: "Revision of Al-Mulk 67:1–12", sabqi: "Al-Mulk 67:1–12", manzil: "Juz 30 complete" },
  ],
  teacherNote:
    "Alhamdulillah, Yusuf completed the first twelve ayat of Surah Al-Mulk this month and his Juz 30 revision is strong. His Tajweed on Ghunnah has improved. He is sometimes rushed at the start of class; reading the Sabaq once aloud before class helps him settle.",
  goals: [
    "Complete Surah Al-Mulk (67:13–30).",
    "Revise all of Juz 30 twice a week in Manzil.",
    "Hold Ghunnah for its full length in every lesson.",
  ],
} as const;
