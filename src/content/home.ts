import { courseById, fromPrice, isFixedSchedule, monthlyCourses, programs, usd, type CourseId } from "./pricing";
import { courseFaq, teacherMatching } from "./courses";
import { PENDING, site } from "./site";

/*
 * Home page copy for sections 2–10 (spec §7.1), as approved by the owner on
 * 19 Nov 2026. Sections 5 (instructors), 6 (progress) and 7 (testimonials)
 * are left out until real content exists. Every fact names its source.
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
      // Lengths: spec §7.1 section 2, TO CONFIRM. Price rule: PLUGIN-INVENTORY §2.1.
      status: "draft",
      title: "30 or 45 minutes",
      body: "Pick the session length that suits your child. The fee depends only on the number of days.",
    },
  ],
  // Spec §7.1's "free make-up sessions" is replaced by the cancelled-class
  // rule (Tuition & Refund Policy, CONTENT-ADDENDUM.md §2), which appears
  // only in the FAQ.
} as const;

/* ── Fees and aid (shared by Home, course pages and the scholarship copy) ── */

export const aid = {
  // PRODUCT.md "Positioning".
  studyFree: "Nearly half of our students study free.",
  // Live, Donate page (CONTENT-ADDENDUM.md §1).
  subsidized: { status: "live", text: "The rest pay subsidized fees, with tuition reduced by 50%, 45% or 30%." },
} as const;

/* ── 3 · Programs ────────────────────────────────────────────────────────── */

export const programsSection = {
  heading: "Programs for every stage",
  /**
   * The only courses Home lists, in this order (owner, 20 Nov 2026):
   * Noorani Qaidah · Qur’an Nazirah · Qur’an Hifz, then the Weekend and Summer
   * programs below. Every other course is in the catalog only ("See all courses").
   */
  courseIds: ["noorani-qaidah", "quran-nazirah", "quran-hifz"] satisfies CourseId[],
  intro: "Live classes for children, teens and adults, priced by course and by the number of days you choose.",
  monthlyLabel: "Monthly classes",
  programsLabel: "Seasonal and weekend programs",
  // PRODUCT.md "Positioning"; the subsidy line is live (Donate page).
  scholarshipNote: `Scholarships are available. ${aid.studyFree} ${aid.subsidized.text}`,
  scholarshipLink: { label: "Ask about a scholarship", href: "/scholarship" },
  allCourses: { label: "See all courses", href: "/courses" },
  daysLine: (min: number, max: number) =>
    `${min === max ? min : `${min}–${max}`} days a week · 30 or 45 minutes`,
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

/* ── 8 · Giving (the only giving section on Home) ────────────────────────── */

export const giving = {
  heading: aid.studyFree,
  subsidized: aid.subsidized.text,
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
  `${listOf(fromLowest.map((c) => c.label))}: from ${usd(lowestFrom)} a month`,
  ...fromHigher.map((c) => `${c.label}: from ${usd(fromPrice(c))} a month (at least ${c.minDays} days a week)`),
  ...fixedCourses.map((c) => `${c.label}: ${usd(fromPrice(c))} a month (${c.minDays} days a week)`),
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
      a: `Monthly classes start from ${usd(lowestFrom)} a month, and your first month is free. The fee depends on the course and the number of days a week:`,
      points: costPoints,
      after:
        "Fees are in US dollars, and session length does not change the price. Families asking for a scholarship are contacted by our team.",
    },
    {
      status: "draft",
      q: "Is the first month really free?",
      // PRODUCT.md decision 4; owner's wording for the scholarship route. Billing date: PRODUCT.md open decision K1.
      a: "Yes. On a paid plan you add a card at checkout, and nothing is charged during your first month. After that, the fee is charged monthly on your billing date. Families asking for a scholarship are contacted by our team instead.",
    },
    {
      // Owner's wording, 20 Nov 2026 (times are fully flexible).
      status: "live",
      q: "What times are classes?",
      a: "Any time that suits your family. When you enroll you choose your preferred start and end time and your time zone, and we match a teacher to it.",
    },
    {
      status: "draft",
      q: "Are female teachers available?",
      // COURSE-CONTENT.md §1 (owner, 20 Nov 2026); spec §7.1 section 4 (matching by gender preference).
      a: "Yes. Female teachers are offered for sisters and young children. Tell us your preference on the form and we take it into account when we match a teacher.",
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
      a: "Classes are live on Zoom. We recommend a laptop or tablet with a steady internet connection. A phone works, but we don’t recommend it: the screen is too small for reading the Qur’an comfortably.",
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
