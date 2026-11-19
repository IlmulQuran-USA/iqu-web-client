/*
 * Pricing: the single source of truth for every price shown on the site.
 * Source: docs/spec/PLUGIN-INVENTORY.md §2 (the live iqu-registration plugin).
 * Components never hard-code a price; they read these values.
 *
 * TO CONFIRM before publishing: the inventory asks for these to be checked
 * against the live plugin settings (§2.3). The Summer fees are admin settings
 * there (§2.4), not constants; this file mirrors their current values.
 *
 * Rules (§2.1, §2.5): monthly fee = days per week × 4 weeks × per-class rate.
 * Session length does not change the price. USD only. No sibling discount.
 */

export type MonthlyCourse = {
  key: "qaidah" | "hifz" | "arabic" | "tarjumatul_quran" | "islamic_studies";
  /** Owner's spelling: Qur’an with the typographic apostrophe. */
  label: string;
  href: string;
  /** Fewest days a week the course can be taken (Hifz does not progress on fewer than 3). */
  minDays: number;
  maxDays: number;
  /** Per-class rate in USD for a given number of days a week. */
  rate: (daysPerWeek: number) => number;
};

const tiered = (days: number) => (days <= 2 ? 5 : 4); // $5 for 1–2 days · $4 for 3–7 days
const flat5 = () => 5;

export const monthlyCourses: MonthlyCourse[] = [
  { key: "qaidah", label: "Qa’idah & Nazirah", href: "/courses/qaidah-nazirah", minDays: 1, maxDays: 7, rate: tiered },
  { key: "hifz", label: "Qur’an Hifz", href: "/courses/hifz", minDays: 3, maxDays: 7, rate: flat5 },
  { key: "arabic", label: "Arabic Language", href: "/courses/arabic", minDays: 1, maxDays: 7, rate: flat5 },
  {
    key: "tarjumatul_quran",
    label: "Tarjumatul Qur’an",
    href: "/courses/tarjumatul-quran",
    minDays: 1,
    maxDays: 7,
    rate: flat5,
  },
  { key: "islamic_studies", label: "Islamic Studies", href: "/courses/islamic-studies", minDays: 1, maxDays: 7, rate: tiered },
];

/** Monthly fee in USD for a course at a given number of days a week. */
export function monthlyFee(course: MonthlyCourse, daysPerWeek: number): number {
  return daysPerWeek * 4 * course.rate(daysPerWeek);
}

/** The "from" price on course cards: the fee at the course's minimum days (§2.3). */
export function fromPrice(course: MonthlyCourse): number {
  return monthlyFee(course, course.minDays);
}

export const programs = {
  weekend: {
    label: "Weekend Ilm Program",
    href: "/programs/weekend-school",
    ages: "5–12",
    /** Free for everyone, no payment (§1). */
    fee: 0,
  },
  summer: {
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

/** "$20" — whole dollars, USD only. */
export function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
