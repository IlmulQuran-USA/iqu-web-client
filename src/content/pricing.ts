/*
 * Pricing: the single source of truth for every price shown on the site, and
 * for each course's and program's name and URL.
 * Sources: docs/spec/PLUGIN-INVENTORY.md §2 (the live iqu-registration plugin)
 * for rates and rules; docs/spec/COURSE-CONTENT.md (owner, 20 Nov 2026) for
 * names, slugs, and which course uses which rate.
 * Components never hard-code a price; they read these values.
 *
 * TO CONFIRM before publishing: the inventory asks for these to be checked
 * against the live plugin settings (§2.3). The Summer fees are admin settings
 * there (§2.4), not constants; this file mirrors their current values.
 *
 * Rules (§2.1, §2.5): monthly fee = days per week × 4 weeks × per-class rate.
 * Session length does not change the price. USD only. No sibling discount.
 */

/**
 * The plugin's course keys (§2.1). This is what a registration stores, so
 * two courses can share one key: Noorani Qaidah and Qur’an Nazirah are both
 * billed as `qaidah`.
 */
export type PriceKey = "qaidah" | "hifz" | "arabic" | "tarjumatul_quran" | "islamic_studies";

const tiered = (days: number) => (days <= 2 ? 5 : 4); // $5 for 1–2 days · $4 for 3–7 days
const flat5 = () => 5;

/** Per-class rate in USD by plugin key, for a given number of days a week (§2.1). */
const rates: Record<PriceKey, (daysPerWeek: number) => number> = {
  qaidah: tiered,
  hifz: flat5,
  arabic: flat5,
  tarjumatul_quran: flat5,
  islamic_studies: tiered,
};

export type CourseId =
  | "noorani-qaidah"
  | "quran-nazirah"
  | "quran-hifz"
  | "quranic-arabic-level-1"
  | "tarjumatul-quran"
  | "islamic-studies";

export type MonthlyCourse = {
  /** URL slug (COURSE-CONTENT.md). The page is /courses/<id>. */
  id: CourseId;
  /** Owner's spelling: Qur’an with the typographic apostrophe. */
  label: string;
  /** Shorter label for tight navigation (footer columns). Defaults to label. */
  navLabel?: string;
  href: `/courses/${CourseId}`;
  /** The plugin key the course is billed under. */
  priceKey: PriceKey;
  /** Fewest days a week the course can be taken (Hifz does not progress on fewer than 3). */
  minDays: number;
  /** Most days a week. Equal to minDays when the schedule is fixed. */
  maxDays: number;
};

/** The catalog, in the owner's order (COURSE-CONTENT.md §2). */
export const monthlyCourses: MonthlyCourse[] = [
  { id: "noorani-qaidah", label: "Noorani Qaidah", href: "/courses/noorani-qaidah", priceKey: "qaidah", minDays: 1, maxDays: 7 },
  // The same rate and rules as Noorani Qaidah (owner, 20 Nov 2026).
  { id: "quran-nazirah", label: "Qur’an Nazirah", href: "/courses/quran-nazirah", priceKey: "qaidah", minDays: 1, maxDays: 7 },
  { id: "quran-hifz", label: "Qur’an Hifz", href: "/courses/quran-hifz", priceKey: "hifz", minDays: 3, maxDays: 7 },
  {
    id: "quranic-arabic-level-1",
    // "Level 1" never breaks across lines (no-break space).
    label: "Quranic Arabic Mastery — Level 1",
    navLabel: "Quranic Arabic",
    href: "/courses/quranic-arabic-level-1",
    priceKey: "arabic",
    // Fixed at 4 days a week for one year: only the 4-day fee is offered
    // (owner, 20 Nov 2026). The plugin still accepts 1–7 days for `arabic`;
    // bringing it in line is a separate plugin task (COURSE-CONTENT.md C4).
    minDays: 4,
    maxDays: 4,
  },
  {
    id: "tarjumatul-quran",
    label: "Tarjumatul Qur’an",
    href: "/courses/tarjumatul-quran",
    priceKey: "tarjumatul_quran",
    minDays: 1,
    maxDays: 7,
  },
  {
    id: "islamic-studies",
    label: "Islamic Studies",
    href: "/courses/islamic-studies",
    priceKey: "islamic_studies",
    minDays: 1,
    maxDays: 7,
  },
];

export function courseById(id: CourseId): MonthlyCourse {
  const course = monthlyCourses.find((c) => c.id === id);
  if (!course) throw new Error(`Unknown course: ${id}`);
  return course;
}

/** True when the course is offered at one day count only. */
export function isFixedSchedule(course: MonthlyCourse): boolean {
  return course.minDays === course.maxDays;
}

/** Monthly fee in USD for a course at a given number of days a week. */
export function monthlyFee(course: MonthlyCourse, daysPerWeek: number): number {
  if (daysPerWeek < course.minDays || daysPerWeek > course.maxDays) {
    throw new RangeError(`${course.label} is offered at ${course.minDays}–${course.maxDays} days a week, not ${daysPerWeek}`);
  }
  return daysPerWeek * 4 * rates[course.priceKey](daysPerWeek);
}

/** The "from" price on course cards: the fee at the course's minimum days (§2.3). */
export function fromPrice(course: MonthlyCourse): number {
  return monthlyFee(course, course.minDays);
}

export type ProgramId = "weekend-ilm-program" | "summer-ilm-camp";

export const programs = {
  weekend: {
    id: "weekend-ilm-program",
    label: "Weekend Ilm Program",
    href: "/programs/weekend-ilm-program",
    ages: "5–12",
    /** Free for everyone, no payment (§1). */
    fee: 0,
  },
  summer: {
    id: "summer-ilm-camp",
    label: "Summer Ilm Camp",
    href: "/programs/summer-ilm-camp",
    ages: "5–15",
    length: "two months",
    /** One-time fee for the whole program: admin setting `summer_fee` (§2.4). */
    fee: 40,
    /**
     * Reduced ("supported") fee: admin setting `summer_fee_supported` (§2.4).
     * Owner decision, 19 Nov 2026: shown only inside the enrolment flow; Home
     * says only that a reduced option exists.
     */
    supportedFee: 30,
  },
} as const;

/**
 * Launch gate for every price in this file, listed by `npm run content:check`.
 * Set status to "live" once the values are confirmed against the live plugin
 * settings (PLUGIN-INVENTORY §2.3).
 */
export const priceConfirmation = {
  status: "draft",
  text: "Rates, minimum days and the Summer fees mirror PLUGIN-INVENTORY §2; confirm them against the live plugin settings.",
} as const;

/** "$20" — whole dollars, USD only. */
export function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
