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
 * two courses can share one key: Noorani Qaidah and Quran Nazirah are both
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

/** The plugin's fewest days a week per key (IQU_Pricing::calculate, P:238); every key allows at most 7. */
const pluginMinDays: Record<PriceKey, number> = { qaidah: 1, hifz: 3, arabic: 1, tarjumatul_quran: 1, islamic_studies: 1 };

export function isPriceKey(key: string): key is PriceKey {
  return Object.hasOwn(rates, key);
}

/**
 * IQU_Pricing::calculate($key, $days)['monthly_amount'] in USD, or null where
 * the plugin refuses it (P:220-264). Billing and the discount ledger price a
 * stored registration by its key, as the plugin does (imported and admin rows
 * included), so this follows the plugin's day limits, not the website's
 * course pages (Arabic is offered at 4 days on the site but priced 1–7 here).
 */
export function monthlyFeeForKey(key: string, days: number): number | null {
  if (!isPriceKey(key) || !Number.isInteger(days) || days < pluginMinDays[key] || days > 7) return null;
  return days * 4 * rates[key](days);
}

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
  /** Owner's spelling: Quran with the typographic apostrophe. */
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
  { id: "quran-nazirah", label: "Quran Nazirah", href: "/courses/quran-nazirah", priceKey: "qaidah", minDays: 1, maxDays: 7 },
  { id: "quran-hifz", label: "Quran Hifz", href: "/courses/quran-hifz", priceKey: "hifz", minDays: 3, maxDays: 7 },
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
    label: "Tarjumatul Quran",
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

/**
 * The Special discount plan (§2.2): a lower monthly fee a family can opt into,
 * Qa'idah / Nazirah only, 3–7 days a week. The plugin recalculates it on the
 * server (IQU_Pricing::SPECIAL_DISCOUNT); the difference counts under the
 * Special fund. Shown only inside the enrollment flow, never on course pages.
 */
export const specialPlanFees: Partial<Record<PriceKey, Readonly<Record<number, number>>>> = {
  qaidah: { 3: 40, 4: 45, 5: 50, 6: 70, 7: 85 },
};

/** The Special plan fee for this course and day count, or null when there is none. */
export function specialPlanFee(course: MonthlyCourse, daysPerWeek: number): number | null {
  const fee = specialPlanFees[course.priceKey]?.[daysPerWeek];
  return fee !== undefined && fee < monthlyFee(course, daysPerWeek) ? fee : null;
}

/** The "from" price on course cards: the fee at the course's minimum days (§2.3). */
export function fromPrice(course: MonthlyCourse): number {
  return monthlyFee(course, course.minDays);
}

/**
 * Class lengths a family can choose, in minutes: the live plugin's list
 * (IQU_Reg_Fields::SESSION_DURATIONS, read 24 Nov 2026 from v3.7.20). 45 is
 * no longer offered there (removed in v3.7.13). Session length does not
 * change the fee (§2.1).
 */
export const sessionMinutes = [30, 40, 50, 60] as const;
export type SessionMinutes = (typeof sessionMinutes)[number];

/** "30, 40, 50 or 60 minutes" (no-break space: "60 minutes" never splits across lines). */
export const sessionLengths = `${sessionMinutes.slice(0, -1).join(", ")} or ${sessionMinutes.at(-1)} minutes`;

/** The same list that never wraps, for " · "-joined meta lines: they break between facts, not inside the list. */
export const sessionLengthsNoWrap = sessionLengths.replaceAll(" ", " ");

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
    /** CONTENT-ADDENDUM.md §5 (live): 1 Jun – 31 Jul 2026, Monday–Thursday. */
    length: "8 weeks",
    /** One-time fee for the whole program: admin setting `summer_fee` (§2.4). */
    fee: 40,
    /**
     * Reduced ("supported") fee: admin setting `summer_fee_supported` (§2.4).
     * NEVER shown anywhere public (owner, 24 Nov 2026, correction A): families
     * who need help choose "I need help with the fee" instead. Kept only so
     * this file mirrors the plugin settings.
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
