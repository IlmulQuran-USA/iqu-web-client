import { draft } from "./copy";
import { scholarship } from "./course-page";
import { courseFaq, courseRules, courses, programList, type Course, type Program } from "./courses";
import { homeHero } from "./home-hero";
import { faq as homeFaq, finalCta, programsSection, teachersSection } from "./home";
import { instructors } from "./instructors";
import { featuredProgram } from "./navigation";
import { courseById, fromPrice, monthlyCourses, programs, usd, type CourseId } from "./pricing";
import type { CopyText } from "./types";

/*
 * Course catalog, /courses (spec §7.2; plan approved by the owner, 21 Nov 2026).
 * Every fact comes from ./pricing, ./courses, ./instructors and ./home; this
 * file only arranges it. New wording is marked draft so `npm run
 * content:check` lists it for the owner.
 *
 * Owner decisions, 21 Nov 2026:
 *   - all eight offerings of COURSE-CONTENT.md §2, each linking to its page;
 *   - one filter only, backed by real data: All · Monthly courses · Programs;
 *     no age, level, format, language or teacher-gender facets, and no
 *     "Adults" tag (the data gives no age for Quranic Arabic or Tarjumatul);
 *   - two monthly groups: the learning path (Noorani Qaidah → Quran Nazirah →
 *     Quran Hifz), then "Understand the Quran and Islam";
 *   - no sort, no compare drawer; the quiz becomes a visible "Where to start".
 */

/* ── Filter (state in the URL: /courses?type=monthly) ────────────────────── */

export const CATALOG_TYPES = ["all", "monthly", "programs"] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export const typeFilter = {
  label: "Show",
  options: [
    { id: "all", label: "All", href: "/courses" },
    { id: "monthly", label: "Monthly courses", href: "/courses?type=monthly" },
    { id: "programs", label: "Programs", href: "/courses?type=programs" },
  ] satisfies { id: CatalogType; label: string; href: string }[],
} as const;

/** An unknown or missing value shows everything. */
export function catalogType(value: string | string[] | undefined): CatalogType {
  const v = Array.isArray(value) ? value[0] : value;
  return (CATALOG_TYPES as readonly string[]).includes(v ?? "") ? (v as CatalogType) : "all";
}

/* ── Header ──────────────────────────────────────────────────────────────── */

const pathIds = ["noorani-qaidah", "quran-nazirah", "quran-hifz"] satisfies CourseId[];
const understandIds = ["quranic-arabic-level-1", "tarjumatul-quran", "islamic-studies"] satisfies CourseId[];
// Every monthly course is in exactly one group, so a new course can never go missing from the page.
{
  const grouped = new Set<string>([...pathIds, ...understandIds]);
  const missing = monthlyCourses.filter((c) => !grouped.has(c.id)).map((c) => c.id);
  if (missing.length || grouped.size !== monthlyCourses.length) {
    throw new Error(`Catalog groups and ./pricing disagree. Not in a group: ${missing.join(", ") || "none"}.`);
  }
}

const lowestFrom = Math.min(...monthlyCourses.map(fromPrice));

export const catalogHeader = {
  id: "catalog-header",
  title: "Courses",
  // Home's approved line (programsSection.intro).
  intro: programsSection.intro,
  // The count lives in the filter's status line ("Showing 8 of 8"), so the header does not repeat it.
  showing: (shown: number) =>
    `Showing ${shown} of ${courses.length + programList.length}: ${courses.length} monthly courses and ${programList.length} programs`,
  showingFiltered: (shown: number) => `Showing ${shown} of ${courses.length + programList.length}`,
  /**
   * What every monthly course shares, stated once instead of as filters:
   * COURSE-CONTENT.md §1 (live), the owner's flexible-time rule (Home
   * schedule, live, 20 Nov 2026) and PRODUCT.md decision 4. The certificate
   * is in the FAQ; the programs' certificate is still undecided (C3).
   */
  facts: [
    "Live on Zoom",
    "One-on-one or a small group",
    "Any time, in your time zone",
    "Taught in English, Bengali, Arabic and Urdu",
    "First month free on monthly courses",
  ],
} as const;

/** Search title and description (at most 160 characters; pageMetadata checks). */
export const catalogMeta = {
  title: "Online Quran and Islamic Courses",
  description: `Noorani Qaidah, Nazirah, Hifz, Quranic Arabic, Tarjumatul Quran and Islamic Studies, live on Zoom from ${usd(lowestFrom)} a month, plus free weekend classes.`,
} as const;

/* ── The list ────────────────────────────────────────────────────────────── */

export type CatalogRow = {
  id: string;
  href: string;
  name: string;
  /** One or two sentences on what it is: the course's meta description. */
  summary: string | null;
  /** Days, session length and length of the course or program. */
  meta: string;
  price: { amount: string; prefix?: string; suffix?: string; note?: string };
};

function courseRow(course: Course): CatalogRow {
  const c = course.content;
  const duration = !c.duration || c.duration.status === "pending" ? null : c.duration.text;
  const fixed = course.minDays === course.maxDays;
  return {
    id: course.id,
    href: course.href,
    name: course.label,
    summary: c.meta.status === "pending" ? null : c.meta.text,
    meta: [programsSection.daysLine(course.minDays, course.maxDays), duration?.toLowerCase()]
      .filter(Boolean)
      .join(" · "),
    // "From $20/month"; a fixed-schedule course has one fee: "$80/month" (owner's price format, 20 Nov 2026).
    price: {
      amount: usd(fromPrice(course)),
      prefix: fixed ? undefined : "from",
      suffix: "/month",
    },
  };
}

function programRow(program: Program): CatalogRow {
  const overview = program.content.overview.status === "pending" ? null : program.content.overview.text;
  const weekend = program.id === programs.weekend.id;
  return {
    id: program.id,
    href: program.href,
    name: program.label,
    // The overview's first sentence: the programs have no meta description yet.
    summary: overview ? overview.split(/(?<=\.)\s/)[0] : null,
    meta: weekend ? programsSection.weekendMeta : programsSection.summerMeta,
    price: weekend
      ? { amount: "Free" }
      : // Owner, 19 Nov 2026: the reduced amount appears only in the enrolment flow.
        {
          amount: programsSection.summerPrice,
          note: programsSection.summerPriceNote,
        },
  };
}

export const catalogGroups = [
  {
    id: "learning-path",
    type: "monthly",
    heading: "The learning path",
    // COURSE-CONTENT.md §1 (live).
    intro: courseRules.learningPath,
    steps: true,
    rows: pathIds.map((id) => courseRow(courses.find((c) => c.id === id)!)),
  },
  {
    id: "understand",
    type: "monthly",
    heading: "Understand the Quran and Islam", // Owner, 21 Nov 2026.
    intro: draft(
      "For students who can read the Quran and want to understand it, and for anyone who wants structured Islamic knowledge.",
    ),
    steps: false,
    rows: understandIds.map((id) => courseRow(courses.find((c) => c.id === id)!)),
  },
  {
    id: "programs",
    type: "programs",
    heading: programsSection.programsLabel,
    intro: null,
    steps: false,
    rows: programList.map(programRow),
  },
] as const satisfies {
  id: string;
  type: Exclude<CatalogType, "all">;
  heading: string;
  intro: CopyText | null;
  steps: boolean;
  rows: CatalogRow[];
}[];

/** Under the list. PRODUCT.md decision 4; K1 (closed 24 Nov 2026: charged on the 1st); PLUGIN-INVENTORY §2.1. */
export const feeNote = {
  id: "fees",
  heading: "Fees and scholarships",
  // The course pages' scholarship wording (course-page.ts).
  scholarship: scholarship.body,
  scholarshipRoute: scholarship.route,
  scholarshipLink: scholarship.link,
  points: [
    "Your first month is free. After the free first month, tuition is charged on the 1st of each month.",
    // PLUGIN-INVENTORY §2.1/§2.3: the from-price is the fee at the course's fewest days a week.
    "Monthly fees depend on the course and the number of days a week. A “from” price is the fee at the fewest days the course allows. Class length does not change the fee.",
    "Fees are in US dollars, for each student.",
  ],
  // The middle point is new wording (the explanation of “from”).
  status: "draft",
} as const;

/* ── Where to start (replaces spec §7.2's quiz) ──────────────────────────── */

/**
 * Starting points written from each course's live "Who it's for" line
 * (COURSE-CONTENT.md) and the programs' ages (PLUGIN-INVENTORY §1).
 * The wording is new, so it is draft until the owner confirms it.
 */
export const whereToStart = {
  id: "where-to-start",
  heading: "Where to start",
  /** The link to this section from the page header. */
  jumpLabel: "Not sure where to start?",
  intro: draft("Find the student’s starting point. Each course page has the full detail."),
  // The rows are new wording too.
  status: "draft",
  rows: [
    {
      when: "Starting from the beginning, child or adult",
      ids: ["noorani-qaidah"],
    },
    {
      when: "Has finished the Qaidah, or reads Arabic letters with their vowel marks (harakat)",
      ids: ["quran-nazirah"],
    },
    {
      when: "Reads the Quran fluently and wants to memorize it",
      ids: ["quran-hifz"],
    },
    {
      when: "Reads the Quran fluently and wants to understand it",
      ids: ["quranic-arabic-level-1", "tarjumatul-quran"],
    },
    {
      when: "Wants structured Islamic knowledge alongside Quran classes",
      ids: ["islamic-studies"],
    },
    {
      when: `A child aged ${programs.weekend.ages} who is free on weekends`,
      ids: [programs.weekend.id],
    },
    {
      when: `A child aged ${programs.summer.ages}, during the summer break`,
      ids: [programs.summer.id],
    },
  ].map((row) => ({
    when: row.when,
    links: row.ids.map((id) => {
      const program = programList.find((p) => p.id === id);
      return program
        ? { label: program.label, href: program.href }
        : {
            label: courseById(id as CourseId).label,
            href: courseById(id as CourseId).href,
          };
    }),
  })),
} as const;

/* ── Teachers, FAQ, final band ───────────────────────────────────────────── */

export const catalogTeachers = {
  id: "teachers",
  heading: teachersSection.heading,
  // COURSE-CONTENT.md §1 (live, owner's wording 20 Nov 2026).
  rule: courseRules.teacherAssignment.text,
  /**
   * Two rows, so sisters see the teachers they would learn with (critique,
   * 21 Nov 2026): the five Home hero teachers, then Home §5's approved row of
   * female teachers (owner, 20 Nov 2026). Ids only: ./instructors holds the people.
   */
  rows: [
    {
      heading: teachersSection.rows[0].heading,
      ids: homeHero.featuredInstructorIds,
    },
    {
      heading: teachersSection.rows[1].heading,
      ids: teachersSection.rows[1].ids,
    },
  ],
  all: {
    label: `Meet all ${instructors.length} teachers`,
    href: teachersSection.all.href,
  },
} as const;

export const catalogFaq = {
  id: "questions",
  heading: "Common questions",
  /**
   * Home's questions that a parent comparing courses asks (cost, the free
   * month, times and time zones, female teachers, age, cancelled classes),
   * then the course pages' question on changing later. Not repeated: what the
   * fact strip already says (format, certificate) and equipment (course pages).
   */
  items: [
    ...[
      "How much do classes cost?",
      "Is the first month really free?",
      "What times are classes?",
      "Are female teachers available?",
      "What is the youngest age you teach?",
      "What if a class is cancelled?",
    ].map((q) => {
      const item = homeFaq.items.find((i) => i.q === q);
      if (!item) throw new Error(`The Home FAQ no longer has "${q}"`);
      return item;
    }),
    // "Can we change days or the course later?"
    courseFaq[4],
  ],
} as const;

export const catalogFinal = finalCta;

/* ── Programs call to action (owner, 21 Nov 2026; draft copy) ─────────────── */

/** "5–15": the widest age range across the programs, from ./pricing. */
function programAges(): string {
  const ranges = Object.values(programs).map((p) => p.ages.split("–").map(Number));
  return `${Math.min(...ranges.map((r) => r[0]))}–${Math.max(...ranges.map((r) => r[1]))}`;
}

/**
 * Final band and phone bottom bar wherever the free first month does not
 * apply. Amounts come from ./pricing. On the catalog the button goes to the
 * flagship program the owner chose for the Courses menu (featuredProgram:
 * the Weekend Ilm Program) and keeps the generic "Enroll in a program",
 * since that view covers both programs. Each program page passes its own
 * specific label, heading and reassurance (owner, 23 Nov 2026: never a
 * generic label that hides where the button goes); see ./program-page.
 */
export function programsCta(
  options: { href?: string; label?: string; heading?: string; reassurance?: string } = {},
) {
  const weekend = programs.weekend.fee === 0 ? "Weekend is free." : `Weekend is ${usd(programs.weekend.fee)}.`;
  return {
    status: "draft",
    heading: options.heading ?? `Weekend and summer programs for ages ${programAges()}.`,
    button: { label: options.label ?? "Enroll in a program", href: options.href ?? featuredProgram.href },
    reassurance:
      options.reassurance ?? `${weekend} Summer is a one-time ${usd(programs.summer.fee)} fee, with a reduced option.`,
  } as const;
}

/** The catalog's instance (exported as a value so `npm run content:check` lists the draft). */
export const catalogProgramsCta = programsCta();

/** A catalog row (name, summary, days, price, link) by course or program id, for lists elsewhere. */
export function catalogRowFor(id: string): CatalogRow | undefined {
  for (const group of catalogGroups) {
    const row = group.rows.find((r) => r.id === id);
    if (row) return row;
  }
  return undefined;
}

/**
 * The final band's copy for a page: the free-first-month wording for monthly
 * courses (Home's approved finalCta, optionally with a course pre-filled), or
 * the programs wording where the free month does not apply.
 */
export function finalCtaFor(kind: "course" | "program", href?: string) {
  if (kind === "program") return programsCta({ href });
  return { ...finalCta, button: { ...finalCta.button, href: href ?? finalCta.button.href } };
}
