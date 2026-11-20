import { courses, courseFaq, courseRules, teacherMatching, type Course } from "./courses";
import { aid, faq as homeFaq, howItWorks, schedule as homeSchedule } from "./home";
import { instructors } from "./instructors";
import { fromPrice, isFixedSchedule, monthlyFee, usd, type CourseId } from "./pricing";
import type { CopyList, CopyText, Instructor } from "./types";

/*
 * The course detail page (spec §7.3; plan approved by the owner, 20 Nov 2026).
 * One template for every course: this file turns a course's copy and prices
 * into what the page shows, and leaves out anything that is pending, so a
 * section is never rendered empty. No level badge, age range, slot
 * availability, reviews, ratings, student counts or sibling discount
 * (owner, 20 Nov 2026). Prices come only from ./pricing.
 */

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** Text that may render: live or draft. Pending never renders. */
export function shown(copy: CopyText | undefined): string | null {
  return copy && copy.status !== "pending" ? copy.text : null;
}
export function shownList(copy: CopyList | undefined): string[] {
  return copy && copy.status !== "pending" ? copy.items : [];
}

/** "1–7 days a week", "4 days a week". */
export function daysLabel(course: Course): string {
  return isFixedSchedule(course) ? `${course.minDays} days a week` : `${course.minDays}–${course.maxDays} days a week`;
}

/* ── Page sections and the sub-nav ───────────────────────────────────────── */

export type SectionId = "overview" | "curriculum" | "teachers" | "schedule" | "fees" | "faq";

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Overview",
  curriculum: "Curriculum",
  teachers: "Teachers",
  schedule: "Schedule",
  fees: "Fees",
  faq: "FAQ",
};

export function hasCurriculum(course: Course): boolean {
  const { curriculum, method, path, assessment, outcomes } = course.content;
  return (
    (curriculum !== undefined && curriculum.kind !== "pending") ||
    (method !== undefined && method.kind !== "pending") ||
    shownList(path).length > 0 ||
    shownList(assessment).length > 0 ||
    shownList(outcomes).length > 0
  );
}

/** The heading for the curriculum section: what it actually holds. */
export function curriculumHeading(course: Course): string {
  const { curriculum, method } = course.content;
  const hasPlan = curriculum !== undefined && curriculum.kind !== "pending";
  const hasMethod = method !== undefined && method.kind !== "pending";
  if (hasPlan && hasMethod) return "Curriculum and method";
  if (hasMethod) return "How it is taught";
  return "Curriculum";
}

/** The live list, then any teachers added from their own profiles (draft). */
export function teachersOf(course: Course): Instructor[] {
  const { teachers, profileTeachers } = course.content;
  const ids = [...(teachers.status === "pending" ? [] : teachers.ids), ...(profileTeachers?.ids ?? [])];
  return [...new Set(ids)].map((id) => {
    const person = instructors.find((i) => i.id === id);
    if (!person) throw new Error(`Unknown instructor ${id} on ${course.id}`);
    return person;
  });
}

/**
 * Highlights, minus any claim about male and female teachers when the
 * course's teacher list does not have both (owner, 20 Nov 2026).
 */
const BOTH_GENDERS_CLAIM = /\bmale\b.*\bfemale\b|\bfemale\b.*\bmale\b/i;
export function highlightsOf(course: Course): string[] {
  const items = shownList(course.content.highlights);
  const genders = new Set(teachersOf(course).map((p) => p.gender));
  const hasBoth = genders.has("male") && genders.has("female");
  return hasBoth ? items : items.filter((item) => !BOTH_GENDERS_CLAIM.test(item));
}

/** Only the sections this course has, in page order. */
export function sectionsOf(course: Course): { id: SectionId; label: string }[] {
  const present: Record<SectionId, boolean> = {
    overview: overviewBlocks(course).length > 0 || highlightsOf(course).length > 0,
    curriculum: hasCurriculum(course),
    teachers: teachersOf(course).length > 0,
    schedule: true,
    fees: true,
    faq: true,
  };
  return (Object.keys(SECTION_LABELS) as SectionId[])
    .filter((id) => present[id])
    .map((id) => ({ id, label: SECTION_LABELS[id] }));
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

/** The hero fact row. Languages are not here: they belong to each teacher's card (owner, 20 Nov 2026). */
export function heroFacts(course: Course): string[] {
  const facts = [daysLabel(course), "30 or 45 minutes"];
  const duration = shown(course.content.duration);
  if (duration) facts.push(duration);
  facts.push("One-on-one or small group"); // courseRules.format (live)
  if (course.content.certificate.value) facts.push("Certificate");
  return facts;
}

export const ctas = (course: Course) => ({
  enrol: { label: "Start free trial", href: `/enroll?course=${course.id}` },
  // Owner, 20 Nov 2026: a plain link, no drawer and no WhatsApp automation.
  ask: { label: "Ask a question", href: `/contact?course=${course.id}` },
});

export const scholarshipLink = { label: "Ask about a scholarship", href: "/scholarship" } as const;

/* ── Overview ────────────────────────────────────────────────────────────── */

// The owner's equipment answer (19 Nov 2026), shared with the Home FAQ.
const equipment = homeFaq.items.find((item) => item.q === "What do we need for classes?");
if (!equipment) throw new Error("The Home FAQ no longer has the equipment answer");

/** Labelled short blocks for the overview, in reading order. */
export function overviewBlocks(course: Course): { label: string; text: string }[] {
  const c = course.content;
  const blocks: { label: string; text: string | null }[] = [
    { label: "Who it’s for", text: shown(c.audience) },
    { label: "Where it fits", text: shown(c.placement) },
    { label: "The aim", text: shown(c.objective) },
    { label: "Support between classes", text: shown(c.support) },
    { label: "What you need", text: equipment!.a },
  ];
  return blocks.filter((b): b is { label: string; text: string } => b.text !== null);
}

/* ── Learning path (COURSE-CONTENT.md §1: Noorani Qaidah → Nazirah → Hifz) ── */

/** The path, built from each course's nextStepId, so it follows the copy. */
const learningPath: Course[] = (() => {
  const nextOf = new Map(courses.map((c) => [c.id, c.content.nextStepId]));
  const pointedTo = new Set(courses.map((c) => c.content.nextStepId).filter(Boolean));
  const head = courses.find((c) => c.content.nextStepId && !pointedTo.has(c.id));
  const path: Course[] = [];
  for (let id = head?.id; id; id = nextOf.get(id as CourseId) as CourseId | undefined) {
    const course = courses.find((c) => c.id === id);
    if (!course || path.includes(course)) break;
    path.push(course);
  }
  return path;
})();

export const learningPathText = courseRules.learningPath.text;

/** The path with this course marked, or null when the course is not on it. */
export function pathFor(course: Course) {
  const at = learningPath.findIndex((c) => c.id === course.id);
  if (at < 0) return null;
  return {
    steps: learningPath.map((c, i) => ({ id: c.id, label: c.label, href: c.href, current: i === at })),
    previous: learningPath[at - 1] ?? null,
    next: learningPath[at + 1] ?? null,
  };
}

/* ── Schedule ────────────────────────────────────────────────────────────── */

export function schedulePoints(course: Course): { status: string; title: string; body: string }[] {
  // Home's flexible-time point (owner, 20 Nov 2026) and its session-length point.
  const [anyTime, , length] = homeSchedule.points;
  const fixedLine = shownList(course.content.schedule)[0];
  const days = isFixedSchedule(course)
    ? `${fixedLine ?? `${inWords(course.minDays)} days a week.`} No other schedule is offered for this course.`
    : course.minDays > 1
      ? // PLUGIN-INVENTORY §2.1: Hifz does not progress on fewer days.
        `Choose from ${inWords(course.minDays)} to ${inWords(course.maxDays)} days a week. ${course.label} needs at least ${inWords(course.minDays)} to make steady progress.`
      : `Choose any number of days, from ${inWords(course.minDays)} to ${inWords(course.maxDays)} a week.`;
  return [
    { status: "live", title: daysLabel(course), body: days },
    anyTime,
    // Adult courses address the student as "you", never "your child" (owner, 20 Nov 2026).
    course.content.forAdults ? { ...length, body: length.body.replace("suits your child", "suits you") } : length,
  ];
}

/* ── Fees ────────────────────────────────────────────────────────────────── */

/** The monthly fee for every day count this course offers (Arabic Level 1: the 4-day fee only). */
export function feeRows(course: Course): { days: number; label: string; fee: string }[] {
  const rows = [];
  for (let d = course.minDays; d <= course.maxDays; d++) {
    rows.push({ days: d, label: `${d} ${d === 1 ? "day" : "days"} a week`, fee: usd(monthlyFee(course, d)) });
  }
  return rows;
}

/** "From $20/month"; a fixed-schedule course has one fee, so no "From": "$80/month" (owner's price format, 20 Nov 2026). */
export const fromLine = (course: Course) =>
  `${isFixedSchedule(course) ? "" : "From "}${usd(fromPrice(course))}/month`;

/** "Taught by A", "Taught by A and B", "Taught by A, B and 8 more". */
export function taughtBy(course: Course): string | null {
  const names = teachersOf(course).map((p) => p.name);
  if (names.length === 0) return null;
  if (names.length <= 2) return `Taught by ${names.join(" and ")}`;
  if (names.length === 3) return `Taught by ${names[0]}, ${names[1]} and ${names[2]}`;
  return `Taught by ${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

// What happens after "Start free trial": the owner's approved wording (Home "How it works", 19 Nov 2026).
const afterClickStep = howItWorks.steps.find((s) => s.title === "Your first month is free");
if (!afterClickStep) throw new Error("Home How it works no longer has the first-month step");
export const afterClick = afterClickStep.body;

/** Under the fee table. PRODUCT.md decision 4; K1 (billing date); PLUGIN-INVENTORY §2.1 and §2.5. */
export function feeNotes(course: Course): string[] {
  return [
    "Your first month is free. After that, the fee is charged monthly on your billing date.",
    "Session length does not change the fee.",
    // Adult courses address the student as "you" (owner, 20 Nov 2026).
    `Fees are in US dollars, for each ${course.content.forAdults ? "student" : "child"}.`,
  ];
}

export const scholarship = {
  heading: "Scholarships",
  body: `${aid.studyFree} ${aid.subsidized.text}`,
  // The owner's wording for the scholarship route (19 Nov 2026).
  route: "Families asking for a scholarship are contacted by our team.",
  link: scholarshipLink,
} as const;

/* ── Teachers and FAQ ────────────────────────────────────────────────────── */

export const teachersIntro = teacherMatching.text;

/** The Teachers section's groups, in this order (owner, 20 Nov 2026; COURSE-CONTENT.md §1). */
export const teacherGroups = [
  { gender: "male", heading: "For brothers", empty: "No male teacher is listed for this course yet." },
  {
    gender: "female",
    heading: "For sisters and boys up to 10",
    empty: "No female teacher is listed for this course yet.",
  },
] as const;

/**
 * Owner, 20 Nov 2026: on a course with no female teacher listed, the gender
 * question says so instead of a plain "Yes", so the FAQ never contradicts
 * the Teachers section.
 */
const NO_FEMALE_TEACHER_ANSWER =
  "Brothers learn with male teachers. No female teacher is listed for this course yet; ask us and we’ll tell you the options.";

/** The addendum's five course questions; the certificate answer only where there is one. */
export function faqFor(course: Course): { q: string; a: string }[] {
  const hasFemale = teachersOf(course).some((p) => p.gender === "female");
  return courseFaq
    .filter((item) => item.q !== "Is there a certificate?" || course.content.certificate.value === true)
    .map((item) =>
      item.q === "Can I choose a male or female teacher?" && !hasFemale ? { ...item, a: NO_FEMALE_TEACHER_ANSWER } : item,
    );
}

/** Every course by slug, for the route. */
export function courseBySlug(slug: string): Course | undefined {
  return courses.find((c) => c.id === slug);
}
