import { fromPrice, monthlyCourses, programs, usd } from "./pricing";
import { PENDING, site } from "./site";

/*
 * Home page copy for sections 2–10 (spec §7.1), as approved by the owner on
 * 19 Nov 2026. Sections 5 (instructors), 6 (progress) and 7 (testimonials)
 * are left out until real content exists. Every fact names its source.
 * Prices are never typed here: they come from ./pricing.
 */

/* ── 2 · Scheduling ──────────────────────────────────────────────────────── */

export const schedule = {
  // "time\u00A0zone" stays on one line when the heading is balanced.
  heading: "Your time\u00A0zone, not ours.",
  /** Spec §7.1 section 2. TO CONFIRM with the owner before launch. */
  teachingHours: { from: 6, to: 23, label: "6 AM–11 PM", zones: "ET, CT, MT and PT" },
  points: [
    {
      title: "6 AM–11 PM, your time",
      // Spec §7.1 section 2. TO CONFIRM.
      body: "Classes run from 6 AM to 11 PM in Eastern, Central, Mountain and Pacific time.",
    },
    {
      title: "Choose your days",
      // PLUGIN-INVENTORY §2.1: 1–7 days a week; Hifz needs at least 3.
      body: "Anywhere from one to seven days a week. Hifz needs at least three to make steady progress.",
    },
    {
      title: "30 or 45 minutes",
      // Lengths: spec §7.1 section 2, TO CONFIRM. Price rule: PLUGIN-INVENTORY §2.1.
      body: "Pick the session length that suits your child. The fee depends only on the number of days.",
    },
  ],
  /**
   * Spec §7.1 lists free make-up sessions. Owner, 19 Nov 2026: not shown
   * until the make-up policy is confirmed.
   */
  makeUpSessions: PENDING,
} as const;

/* ── 3 · Programs ────────────────────────────────────────────────────────── */

export const programsSection = {
  heading: "Programs for every stage",
  intro: "Live classes for children, teens and adults, priced by course and by the number of days you choose.",
  monthlyLabel: "Monthly classes",
  programsLabel: "Seasonal and weekend programs",
  // PRODUCT.md "Positioning": nearly half of students study free.
  scholarshipNote: "Scholarships are available. Nearly half of our students study free.",
  scholarshipLink: { label: "Ask about a scholarship", href: "/scholarship" },
  allCourses: { label: "See all courses", href: "/courses" },
  daysLine: (min: number, max: number) => `${min}–${max} days a week · 30 or 45 minutes`,
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
      title: "We match you with a teacher",
      // Spec §7.1 section 4. TO CONFIRM the matching criteria.
      body: "By level, preferred teacher gender, language and schedule.",
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
  // PRODUCT.md "Positioning".
  heading: "Nearly half of our students study free.",
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

const monthlyFrom = (key: (typeof monthlyCourses)[number]["key"]) => usd(fromPrice(monthlyCourses.find((c) => c.key === key)!));
const twentyCourses = monthlyCourses.filter((c) => fromPrice(c) === fromPrice(monthlyCourses[0]));

/**
 * DRAFT answers, built only from the sources named on each. The owner reviews
 * them before they ship (19 Nov 2026). No FAQPage structured data yet.
 */
export const faq = {
  heading: "Common questions",
  all: { label: "All questions", href: "/faq" },
  items: [
    {
      q: "How much do classes cost?",
      // PLUGIN-INVENTORY §2.1–§2.5 via ./pricing; PRODUCT.md decision 4; owner's scholarship route.
      a: `Monthly classes are priced by course and by the number of days a week. ${twentyCourses
        .map((c) => c.label)
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1")} start from ${monthlyFrom("qaidah")} a month, and Qur’an Hifz from ${monthlyFrom("hifz")} a month at its minimum of three days. Session length does not change the price, and fees are in US dollars. The ${programs.weekend.label} is free, and the ${programs.summer.label} is ${usd(programs.summer.fee)} one-time, with a reduced option. On monthly classes your first month is free. Families asking for a scholarship are contacted by our team.`,
    },
    {
      q: "Is the first month really free?",
      // PRODUCT.md decision 4; owner's wording for the scholarship route.
      a: "Yes. On a paid plan you add a card at checkout, and nothing is charged during your first month. After that, the monthly fee is charged on the 1st of each month. Families asking for a scholarship are contacted by our team instead.",
    },
    {
      q: "What times are classes?",
      // Spec §7.1 section 2 (hours, lengths: TO CONFIRM); PLUGIN-INVENTORY §2.1 (days).
      a: "Classes run from 6 AM to 11 PM in Eastern, Central, Mountain and Pacific time. You choose from one to seven days a week (at least three for Hifz) and a 30- or 45-minute session.",
    },
    {
      q: "Are female teachers available?",
      // PRODUCT.md "Users"; spec §7.1 section 4 (matching by gender preference).
      a: "Yes. Female teachers are offered for girls and young children. Tell us your preference on the form and we take it into account when we match a teacher.",
    },
    {
      q: "What is the youngest age you teach?",
      // PLUGIN-INVENTORY §1 (Weekend 5–12, Summer 5–15). Monthly classes: not documented.
      a: `Children can join the ${programs.weekend.label} (ages ${programs.weekend.ages}) and the ${programs.summer.label} (ages ${programs.summer.ages}) from age 5. Minimum age for monthly classes: ${PENDING}.`,
    },
    {
      q: "What do we need for classes?",
      // PRODUCT.md "Operating Context": classes run on Zoom. Device details: not documented.
      a: `Classes are live on Zoom, so you need a device that can run Zoom and a steady internet connection. Recommended devices and setup: ${PENDING}.`,
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
