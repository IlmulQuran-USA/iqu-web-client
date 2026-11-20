/**
 * Public navigation (spec §6.1 header, §6.2 footer), with course and program
 * names taken from PLUGIN-INVENTORY §1–§2, which wins on data.
 *
 * Every item below is DECIDED (owner, 19 Nov 2026) unless marked OPEN.
 * Change items here, once, and the header, drawer and footer all follow.
 * Course names and routes come from src/content/pricing.ts.
 */

import { courseById, monthlyCourses, programs as pricedPrograms, type CourseId } from "./pricing";

/** A course link for tight columns (footer): uses the short navLabel when there is one. */
const course = (id: CourseId): NavLink => {
  const c = courseById(id);
  return { label: c.navLabel ?? c.label, href: c.href };
};

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  /** Off-site link: opens in a new tab with an external-link marker. */
  external?: boolean;
};

/**
 * Courses ▾ › By level.
 * DECIDED: the full catalog from src/content/pricing.ts, in the owner's order
 * (COURSE-CONTENT.md §2, 20 Nov 2026), with its slugs. Noorani Qaidah and
 * Quran Nazirah are separate courses that share one rate.
 */
export const coursesByLevel: NavLink[] = monthlyCourses.map((c) => ({ label: c.label, href: c.href }));

/**
 * Courses ▾ › By age. Filter state lives in the URL (CLAUDE.md §7).
 * DECIDED: spec §6.1's "Sisters only" is renamed "Female teachers". It is the
 * female-instructor pathway for sisters and boys up to age 10 (owner, 20 Nov 2026),
 * not a women-only class list.
 */
export const coursesByAge: NavLink[] = [
  { label: "Kids 5–12", href: "/courses?age=kids" },
  { label: "Teens", href: "/courses?age=teens" },
  { label: "Adults", href: "/courses?age=adults" },
  { label: "Female teachers", href: "/courses?teacher=female" },
];

/**
 * The promoted card in the Courses panel ("current flagship program").
 * DECIDED: Weekend Ilm Program. Every fact on the card is confirmed
 * (inventory §1: ages 5–12, free for everyone).
 */
export const featuredProgram = {
  label: pricedPrograms.weekend.label,
  href: pricedPrograms.weekend.href,
  summary: "Islamic education on weekends for children aged 5–12.",
  note: "Free for every family",
};

/**
 * Programs ▾.
 * DECIDED: spec §6.1's "Family Plan" is left out. There is no sibling
 * discount ("every child pays the full fee", PRODUCT.md) and no family-plan
 * route.
 */
export const programs: NavLink[] = [
  { label: pricedPrograms.summer.label, href: pricedPrograms.summer.href },
  { label: pricedPrograms.weekend.label, href: pricedPrograms.weekend.href },
  { label: "One-on-one classes", href: "/programs/one-on-one" },
];

/** About ▾ */
export const about: NavLink[] = [
  { label: "Our story", href: "/about" },
  { label: "Why choose us", href: "/about/why-us" },
  { label: "Transparency & finances", href: "/about/transparency" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

/**
 * DECIDED: on mobile the header bar carries no button (spec §6.1).
 * "Start free trial" lives in the drawer and in the sticky bottom bar on
 * course and program pages.
 */
export const primaryLinks = {
  instructors: { label: "Instructors", href: "/instructors" },
  donate: { label: "Donate", href: "/donate" },
  login: { label: "Log in", href: "/login" },
  enrol: { label: "Start free trial", href: "/enroll" },
} as const;

/** Zeffy giving page (owner, 19 Nov 2026). */
export const ZEFFY_GIVING_URL =
  "https://www.zeffy.com/en-US/fundraising/d912691e-fbd0-4140-9453-a7b230b333eb";

/**
 * Footer columns (spec §6.2; owner decision, 19 Nov 2026): exactly six rows
 * each. Support us has five links; its sixth row is the 501(c)(3) · EIN line,
 * drawn by the footer, so the EIN appears only once.
 */
export const footerColumns: { title: string; links: NavLink[]; giving?: boolean }[] = [
  {
    title: "Learn",
    links: [
      { label: "All courses", href: "/courses" },
      course("quran-hifz"),
      course("quranic-arabic-level-1"),
      { label: pricedPrograms.weekend.label, href: pricedPrograms.weekend.href },
      { label: pricedPrograms.summer.label, href: pricedPrograms.summer.href },
      { label: "Free trial", href: "/enroll" },
    ],
  },
  {
    title: "Organization",
    links: [
      { label: "About", href: "/about" },
      { label: "Instructors", href: "/instructors" },
      { label: "Impact", href: "/impact" },
      { label: "Teach with us", href: "/teach" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    /*
     * DECIDED: the Zeffy giving page is linked. "Sponsor a student" stays out
     * until it has a route (spec §7.0 has none).
     */
    title: "Support us",
    giving: true,
    links: [
      { label: "Donate", href: "/donate" },
      { label: "Monthly sustainer", href: "/donate/sustainer" },
      { label: "Zakat scholarship fund", href: "/donate/zakat" },
      { label: "Give on Zeffy", href: ZEFFY_GIVING_URL, external: true },
      { label: "Transparency & finances", href: "/about/transparency" },
    ],
  },
];

/**
 * Social links in the legal strip (spec §6.2).
 * DECIDED: Facebook only; it also carries Messenger. Other networks stay out
 * until confirmed. Lucide has no brand icons, so these are labelled text
 * links, which also follows the spec rule that icons never carry meaning alone.
 */
export const socialLinks: NavLink[] = [
  { label: "Facebook", href: "https://www.facebook.com/ilmulquranusa", external: true },
];

export const legalLinks: NavLink[] = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Refund policy", href: "/legal/refund" },
  { label: "Accessibility statement", href: "/legal/accessibility" },
];
