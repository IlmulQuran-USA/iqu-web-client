import { courseById, fromPrice, isFixedSchedule, monthlyCourses, programs, sessionLengths, sessionLengthsNoWrap, usd, type CourseId } from "./pricing";
import { courseContent, courseFaq, courseRules, teacherMatching } from "./courses";
import { instructors } from "./instructors";
import { PENDING, site } from "./site";
import { LANGUAGES, type Instructor } from "./types";

/*
 * Home page copy for sections 2–10 (spec §7.1), as approved by the owner on
 * 19 Nov 2026, and sections 5–7 (owner, 20 Nov 2026). Every fact names its
 * source; numbers are computed from the data, never typed.
 * Prices are never typed here: they come from ./pricing. Course names and
 * day counts are read from ./pricing too, so this copy stays true when a
 * course changes.
 *
 * Copy that still needs the owner carries `status: "draft"` and is listed by
 * `npm run content:check`.
 */

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);
/** "A", "A and B", "A, B and C". */
const listOf = (items: string[]) =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const hifz = courseById("quran-hifz");
/** Courses offered at one day count only (Quranic Arabic Mastery — Level 1). */
const fixedCourses = monthlyCourses.filter(isFixedSchedule);
const fixedDaysSentence = fixedCourses
  .map((c) => `${c.label} is taught ${inWords(c.minDays)} days a week`)
  .join("; ");

/* ── 2 · Scheduling ──────────────────────────────────────────────────────── */

export const schedule = {
  // "time\u00A0zone" stays on one line when the heading is balanced.
  heading: "Your time\u00A0zone, not ours.",
  // Owner, 20 Nov 2026: class times are fully flexible. There is no
  // teaching-hours window (spec §7.1's "6 AM–11 PM" is superseded): the
  // family chooses its start time, end time and time zone when it enrolls,
  // and a teacher is matched to that time.
  points: [
    {
      status: "live",
      title: "Any time, in your time zone",
      body: "Choose the days and the time that suit your family, in your own time zone, and we match a teacher to it.",
    },
    {
      // PLUGIN-INVENTORY §2.1: 1–7 days a week; Hifz needs at least 3.
      // COURSE-CONTENT.md §6: Quranic Arabic Mastery — Level 1 is fixed at 4.
      status: "live",
      title: "Choose your days",
      body: `Anywhere from one to seven days a week. Hifz needs at least ${inWords(hifz.minDays)} to make steady progress${
        fixedDaysSentence ? `, and ${fixedDaysSentence}` : ""
      }.`,
    },
    {
      // Lengths: the live plugin list (pricing.ts sessionMinutes, 24 Nov 2026). Price rule: PLUGIN-INVENTORY §2.1.
      status: "live",
      title: "Choose your class length",
      body: `Classes can be ${sessionLengths} long. You pick the length when you enroll. Class length does not change the fee.`,
    },
  ],
  // Spec §7.1's "free make-up sessions" is replaced by the cancelled-class
  // rule (Tuition & Refund Policy, CONTENT-ADDENDUM.md §2), which appears
  // only in the FAQ.
} as const;

/* ── Fees and aid (shared by Home, course pages and the scholarship copy) ── */

// PRODUCT.md "Positioning".
const STUDY_FREE = "Nearly half of our students study free.";
// Owner, 22 Nov 2026: listed prices are the full fees; a reduced fee or a full
// scholarship is something a family asks for, never a discount everyone gets.
// Replaces "The rest pay subsidized fees, with tuition reduced by 50%, 45% or 30%."
const ASK_FOR_HELP =
  "Listed prices are the full monthly fees. Families who need help can ask for a reduced fee (30%, 45% or 50% off) or a full scholarship.";

export const aid = {
  studyFree: STUDY_FREE,
  /** Course pages and the /courses fee note: the full wording (owner, 22 Nov 2026). */
  help: { status: "live", text: `${ASK_FOR_HELP} ${STUDY_FREE}` },
  /** Home giving band: without the last sentence, which the hero trust strip already says (owner, 23 and 24 Nov 2026). */
  askForHelp: { status: "live", text: ASK_FOR_HELP },
} as const;

/* ── 3 · Programs ────────────────────────────────────────────────────────── */

export const programsSection = {
  heading: "Programs for every stage",
  /**
   * The only courses Home lists, in this order (owner, 20 Nov 2026):
   * Noorani Qaidah · Quran Nazirah · Quran Hifz, then the Weekend and Summer
   * programs below. Every other course is in the catalog only ("See all courses").
   */
  courseIds: ["noorani-qaidah", "quran-nazirah", "quran-hifz"] satisfies CourseId[],
  intro: "Live classes for children, teens and adults, priced by course and by the number of days you choose.",
  monthlyLabel: "Monthly classes",
  programsLabel: "Seasonal and weekend programs",
  // Critique, owner 20 Nov 2026: the giving band owns the fee-help line; "Nearly half…" is the hero trust strip's (owner, 24 Nov 2026).
  scholarshipNote: "Scholarships are available.",
  scholarshipLink: { label: "Ask about a scholarship", href: "/scholarship" },
  allCourses: { label: "See all courses", href: "/courses" },
  daysLine: (min: number, max: number) =>
    `${min === max ? min : `${min}–${max}`} days a week · ${sessionLengthsNoWrap}`,
  weekendMeta: `Ages ${programs.weekend.ages} · on weekends`,
  summerMeta: `Ages ${programs.summer.ages} · ${programs.summer.length}`,
  // Owner, 19 Nov 2026: the reduced amount appears only in the enrolment flow.
  summerPrice: `${usd(programs.summer.fee)} one-time`,
  summerPriceNote: "reduced option available",
} as const;

/* ── 4 · How it works ────────────────────────────────────────────────────── */

export const howItWorks = {
  heading: "How it works",
  steps: [
    {
      title: "Tell us about your student",
      // Owner, 19 Nov 2026: never state a duration nobody has measured. "No payment" removed: PRODUCT.md decision 4.
      body: "A short form: who is learning, which course, and the days that suit you.",
    },
    {
      // CONTENT-ADDENDUM.md §3.4 (draft).
      status: teacherMatching.status,
      title: "We match you with a teacher",
      body: teacherMatching.text,
    },
    {
      title: "Your first month is free",
      // Owner's wording, 19 Nov 2026 (PRODUCT.md decision 4).
      body: "On a paid plan you add a card at checkout and nothing is charged during the free month. Families asking for a scholarship are contacted by our team instead.",
    },
    {
      title: "Learn and track progress",
      // Owner, 19 Nov 2026: Sabaq · Sabqi · Manzil only as the Hifz example, defined once.
      body: "Classes begin on the days you chose, and progress is followed lesson by lesson.",
      example: "In Hifz this means Sabaq (the new lesson), Sabqi (recent lessons) and Manzil (older portions revised).",
    },
  ],
} as const;

/* ── 5 · Our teachers ────────────────────────────────────────────────────── */

const byId = (id: string): Instructor => {
  const person = instructors.find((i) => i.id === id);
  if (!person) throw new Error(`Unknown instructor ${id}`);
  return person;
};

/*
 * The facts line, counted from src/content/instructors.ts (owner, 20 Nov 2026):
 *   Muftis       the name carries "Mufti";
 *   Huffaz       the name carries Hafez/Hafezah, or a qualification mentions
 *                Hifz, Hafiz or Hafizah (Maha Rashed is a Hafizah by
 *                her bio, but her qualifications are pending, so not counted);
 *   languages    every language a teacher teaches in, in LANGUAGES order.
 * "20 of our teachers": the hero trust strip says "25+ qualified instructors"
 * (owner), and the directory lists 20.
 */
const isHafiz = (p: Instructor) =>
  /^Hafez(ah)?\b/.test(p.name) ||
  (p.qualifications.status !== "pending" && p.qualifications.items.some((q) => /\b(Hifz|Hafiz|Hafizah)\b/.test(q)));
const teachingLanguages = LANGUAGES.filter((l) => instructors.some((p) => p.languages.includes(l)));

export const teachersSection = {
  id: "our-teachers",
  heading: "Our teachers",
  facts: [
    `${instructors.length} of our teachers`,
    `${instructors.filter((p) => /^Mufti\b/.test(p.name)).length} Muftis`,
    `${instructors.filter(isHafiz).length} Huffaz and Hafizahs`,
    `${instructors.filter((p) => p.gender === "female").length} female teachers`,
    listOf([...teachingLanguages]),
  ],
  /** Owner, 20 Nov 2026: two rows, excluding the five hero instructors. */
  rows: [
    {
      heading: "For brothers",
      // Instructor ids, checked against src/content/instructors.ts.
      ids: ["mufti-muaj-al-juhany", "mufti-jubayer-bin-jalaluddin", "mufti-shamsuddin-rois", "mufti-mushfiqur-rahman", "mufti-sajidullah"].map((id) => byId(id).id),
    },
    {
      heading: "For sisters and boys up to 10",
      ids: ["najiba-mahzabin-jeba", "maha-rashed", "hafezah-nuha-rashed", "shifa-jalal", "afra-humayra"].map((id) => byId(id).id),
    },
  ],
  all: { label: "See all teachers", href: "/instructors" },
} as const;

/* ── 6 · How progress is measured ────────────────────────────────────────── */

const noorani = courseContent("noorani-qaidah");
const hifzCopy = courseContent("quran-hifz");
const arabic = courseContent("quranic-arabic-level-1");

/** "10, 20, 30, 40 and 48", read from the Noorani Qaidah class plan's checkpoints. */
const examClasses =
  noorani.curriculum?.kind === "classPlan"
    ? listOf(noorani.curriculum.rows.map((r) => r.checkpoint.match(/class (\d+)/)?.[1]).filter((n): n is string => !!n))
    : "";
const hifzParts = hifzCopy.method?.kind === "steps" ? listOf(hifzCopy.method.steps.map((s) => s.title)) : "";
const arabicChecks = arabic.assessment?.status === "live" ? arabic.assessment.items : [];
if (!examClasses || !hifzParts || arabicChecks.length === 0) throw new Error("Progress facts are missing from courses.ts");

/*
 * Real assessment facts (COURSE-CONTENT.md §1, §3, §5, §6, all live), and the
 * parent dashboard with sample data (owner, 21 Nov 2026: shown for admin
 * review; the portal itself is not built yet).
 */
export const progressSection = {
  heading: "How progress is measured",
  /** Ties the parts together: the course checkpoints and the parent dashboard (critique, 21 Nov 2026). */
  lead: "Every course has checkpoints written into it, and the parent dashboard shows each week as it happens.",
  rows: [
    { label: courseById("noorani-qaidah").label, href: "/courses/noorani-qaidah#curriculum", text: `Revision and an exam after classes ${examClasses}.` },
    { label: courseById("quran-hifz").label, href: "/courses/quran-hifz#curriculum", text: `${hifzParts} in every class: the new lesson, recent lessons and older portions.` },
    {
      label: courseById("quranic-arabic-level-1").label,
      href: "/courses/quranic-arabic-level-1#curriculum",
      text: `${listOf(arabicChecks.map((c, i) => (i === 0 ? c : c.charAt(0).toLowerCase() + c.slice(1))))}.`,
    },
    { label: "Every course", href: null, text: courseRules.certificate.text },
  ],
  /*
   * Proof (live results page, read 20 Nov 2026). Linked on the live site until
   * /results/summer-2026 exists (summerOpen.resultsHref in ./courses).
   */
  proof: {
    status: "live",
    title: "Summer Ilm Camp 2026: final results",
    text: "Every student was assessed in Quran & Tajweed, Aqeedah, Fiqh, Akhlaq and Seerah, 20 marks each.",
    link: { label: "See the 2026 results", href: "https://ilmulquranus.org/summer-program-results/" },
  },
  /*
   * The parent dashboard (owner, 21 Nov 2026): Playwright screenshots of
   * /preview/parent-dashboard with sample data, visible screen only, fonts
   * loaded, animations off: 1280 × 800 at 2× and 393 × 852 at 3×, WebP at
   * quality 90. Re-take them when the dashboard changes, and bump the file
   * name (-v2, -v3…) so no cache serves the old ones. Sample: shown for admin
   * review, to be replaced or confirmed before the public launch.
   */
  dashboard: {
    status: "sample",
    text: "Parent dashboard screenshots and the sample report (sample family data).",
    alt: "Preview of the parent dashboard",
    /** The visible caption: what the dashboard shows, in words (critique, 21 Nov 2026). */
    caption: "The parent dashboard, after every class:",
    callouts: [
      "Each class shows a status from Zoom and the minutes your child and the teacher were in class together.",
      "Sabaq, Sabqi and Manzil after every Hifz class.",
      "The next class, in your own time zone.",
    ],
    desktop: { src: "/images/home/parent-dashboard-desktop-v2.webp", width: 2560, height: 1600 },
    phone: { src: "/images/home/parent-dashboard-phone-v2.webp", width: 1179, height: 2556 },
    report: { label: "See a sample report", href: "/preview/sample-report" },
  },
} as const;

/* ── 7 · What families say ───────────────────────────────────────────────── */

export const familiesSection = {
  heading: "What families say",
} as const;

/* ── 8 · Giving (the only giving section on Home) ────────────────────────── */

export const giving = {
  // Owner, 24 Nov 2026: "Nearly half…" stays only in the hero trust strip, so Home says it once.
  heading: "Your Zakat and donations fund scholarships",
  help: aid.askForHelp.text,
  // Rendered as: <name> is the teaching name of <legal name>, <rest>. Names are marked translate="no".
  bodyJoin: "is the teaching name of",
  bodyRest: `, a ${site.taxStatus}. Donations, including Zakat, go to the scholarship fund that pays for those places.`,
  legal: `${site.taxStatus} · EIN ${site.ein}`,
  links: [
    { label: "How we’re funded", href: "/about/transparency" },
    { label: "Support a student", href: "/donate" },
  ],
  /** PRODUCT.md "Evidence on Hand": absent, never invented. */
  whereTheMoneyGoes: PENDING,
} as const;

/* ── 9 · Common questions ────────────────────────────────────────────────── */

/*
 * The cost answer: one lead sentence, then a short price list built from
 * ./pricing so it names every catalog course and stays true when a price or
 * day count changes:
 *   - courses from the lowest one-day price, together;
 *   - courses with a higher minimum (Hifz), each with its minimum;
 *   - fixed-schedule courses (Arabic Level 1), each with its single fee;
 *   - the two programs.
 */
const flexible = monthlyCourses.filter((c) => !isFixedSchedule(c));
const lowestFrom = Math.min(...flexible.map(fromPrice));
const fromLowest = flexible.filter((c) => fromPrice(c) === lowestFrom);
const fromHigher = flexible.filter((c) => fromPrice(c) !== lowestFrom);
const costPoints = [
  // Prices always as "$20/month" (owner, 20 Nov 2026).
  `${listOf(fromLowest.map((c) => c.label))}: from ${usd(lowestFrom)}/month`,
  ...fromHigher.map((c) => `${c.label}: from ${usd(fromPrice(c))}/month (at least ${c.minDays} days a week)`),
  ...fixedCourses.map((c) => `${c.label}: ${usd(fromPrice(c))}/month (${c.minDays} days a week)`),
  `${programs.weekend.label}: free`,
  `${programs.summer.label}: ${usd(programs.summer.fee)} one-time, with a reduced option`,
];

/**
 * DRAFT answers, built only from the sources named on each. The owner reviews
 * them before they ship (19 Nov 2026). No FAQPage structured data yet.
 */
export const faq = {
  heading: "Common questions",
  all: { label: "All questions", href: "/faq" },
  items: [
    {
      status: "draft",
      q: "How much do classes cost?",
      // PLUGIN-INVENTORY §2.1–§2.5 and COURSE-CONTENT.md via ./pricing; PRODUCT.md decision 4; owner's scholarship route.
      a: `Monthly classes start from ${usd(lowestFrom)}/month, and your first month is free. The fee depends on the course and the number of days a week:`,
      points: costPoints,
      after:
        "Fees are in US dollars, and class length does not change the price. Families asking for a scholarship are contacted by our team.",
    },
    {
      status: "draft",
      q: "Is the first month really free?",
      // PRODUCT.md decision 4; owner's wording for the scholarship route. Billing: K1, closed 24 Nov 2026.
      a: "Yes. On a paid plan you add a card at checkout, and nothing is charged during your free first month. After that, tuition is charged on the 1st of each month. Families asking for a scholarship are contacted by our team instead.",
    },
    {
      // Owner's wording, 20 Nov 2026 (times are fully flexible).
      status: "live",
      q: "What times are classes?",
      a: "Any time that suits your family. When you enroll you choose your preferred start and end time and your time zone, and we match a teacher to it.",
    },
    {
      // Owner's rule and wording, 20 Nov 2026 (courseRules.teacherAssignment).
      status: "live",
      q: "Are female teachers available?",
      a: `Yes. ${courseRules.teacherAssignment.text} Tell us your preference when you enroll.`,
    },
    {
      status: "draft",
      q: "What is the youngest age you teach?",
      // Owner, 19 Nov 2026. Program ages: PLUGIN-INVENTORY §1 via ./pricing.
      a: `Monthly classes usually start from age 6 or 7, depending on the child’s readiness. The ${programs.weekend.label} (ages ${programs.weekend.ages}) and the ${programs.summer.label} (ages ${programs.summer.ages}) welcome children from age 5.`,
    },
    // The cancelled-class rule (Tuition & Refund Policy), worded as on the course pages.
    courseFaq[2],
    {
      status: "draft",
      q: "What do we need for classes?",
      // Owner, 19 Nov 2026.
      a: "Classes are live on Zoom. We recommend a laptop or tablet with a steady internet connection. A phone works, but we don’t recommend it: the screen is too small for reading the Quran comfortably.",
    },
  ],
} as const;

/* ── 10 · Final call to action ───────────────────────────────────────────── */

export const finalCta = {
  // Approved by the owner, 19 Nov 2026.
  heading: "Start with a free first month.",
  button: { label: "Start free trial", href: "/enroll" },
  reassurance: "Nothing is charged during your first month.",
} as const;
