/**
 * Public navigation (spec §6.1 header, §6.2 footer), with course and program
 * names taken from PLUGIN-INVENTORY §1–§2, which wins on data.
 *
 * Every item below is DECIDED (owner, 19 Nov 2026) unless marked OPEN.
 * Change items here, once, and the header, drawer and footer all follow.
 * Course names and routes come from src/content/pricing.ts.
 */

import { builtOnly } from "./planned-pages.ts";
import { courseById, monthlyCourses, programs as pricedPrograms, type CourseId } from "./pricing.ts";

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
 * Courses ▾ › By type: the catalog's filter (/courses?type=…), the only one
 * backed by real data (owner, 21 Nov 2026). The age and teacher links it
 * replaces had no filter behind them: the data gives no age for every course,
 * and the female-teacher pathway is answered on each course page.
 */
export const coursesByType: NavLink[] = [
  { label: "Monthly courses", href: "/courses?type=monthly" },
  { label: "Programs", href: "/courses?type=programs" },
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
export const programs: NavLink[] = builtOnly([
  { label: pricedPrograms.summer.label, href: pricedPrograms.summer.href },
  { label: pricedPrograms.weekend.label, href: pricedPrograms.weekend.href },
  { label: "One-on-one classes", href: "/programs/one-on-one" },
]);

/**
 * About ▾. Every list here passes through builtOnly: a link to a page that is
 * not built yet (./planned-pages.ts) is left out until the page exists.
 */
export const about: NavLink[] = builtOnly([
  { label: "Our story", href: "/about" },
  { label: "Why choose us", href: "/about/why-us" },
  { label: "Transparency & finances", href: "/about/transparency" },
  { label: "Blog", href: "/blog" },
  // Owner, 27 Nov 2026: the FAQ in the About menu and the footer's Organization column.
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
]);

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

/**
 * Log in is shown only where /login opens: the portal is on for this
 * deployment (dev with the preview accounts, or production once
 * PORTAL_DATA=live). NEXT_PUBLIC_PORTAL_ON is set by next.config.ts at build.
 */
export const showLogin = process.env.NEXT_PUBLIC_PORTAL_ON === "1";

/** Zeffy giving page (owner, 19 Nov 2026). */
export const ZEFFY_GIVING_URL =
  "https://www.zeffy.com/en-US/fundraising/d912691e-fbd0-4140-9453-a7b230b333eb";

/**
 * Footer columns (spec §6.2; owner decision, 19 Nov 2026): six rows each once
 * every page exists (Organization seven, with FAQ: owner, 27 Nov 2026); until
 * then, links to pages not built yet are left out (./planned-pages.ts).
 * Support us has five links; its sixth row is the 501(c)(3) · EIN line,
 * drawn by the footer, so the EIN appears only once.
 */
const columns: { title: string; links: NavLink[]; giving?: boolean }[] = [
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
      { label: "FAQ", href: "/faq" },
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

export const footerColumns = columns.map((column) => ({ ...column, links: builtOnly(column.links) }));

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
