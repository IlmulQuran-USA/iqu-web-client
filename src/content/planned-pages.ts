/*
 * Pages that the header, footer and page content link to but that are not
 * built yet (spec §7.0 route map). Until a page exists, every link to it is
 * left out, so the site never links to a 404 (owner, 26 Nov 2026: a crawl of
 * every internal link on dev must find none). Each one is listed by
 * `npm run content:check` as pending. When a page ships, delete its entry
 * here and its links come back on their own.
 *
 * No imports, so the config loader and node tests can read it.
 */

export type PlannedPage = { href: string; label: string; status: "pending"; waitingFor: string };

export const plannedPages: readonly PlannedPage[] = [
  { href: "/about/transparency", label: "Transparency & finances", status: "pending", waitingFor: "Owner Q3 and Q5 (giving-about-shape-plan.md): finance figures, governance documents" },
  { href: "/donate/sustainer", label: "Monthly sustainer", status: "pending", waitingFor: "Owner Q6: tiers and benefits are new promises" },
  { href: "/donate/zakat", label: "Zakat scholarship fund", status: "pending", waitingFor: "Owner Q2 and Q3: Zakat policy and a separate Zeffy Zakat form" },
  { href: "/about/why-us", label: "Why choose us", status: "pending", waitingFor: "Spec §7.7; not planned yet" },
  { href: "/impact", label: "Impact", status: "pending", waitingFor: "Owner Q3: approved figures with an as-of date" },
  { href: "/teach", label: "Teach with us", status: "pending", waitingFor: "Spec §7.16; not planned yet" },
  { href: "/blog", label: "Blog", status: "pending", waitingFor: "Spec §7.13; no articles yet" },
  { href: "/faq", label: "FAQ", status: "pending", waitingFor: "Spec §7.14; the Home answers are still drafts" },
  { href: "/programs/one-on-one", label: "One-on-one classes", status: "pending", waitingFor: "Spec §7.11; not planned yet" },
  { href: "/login", label: "Log in", status: "pending", waitingFor: "The portal (spec §7B); no sign-in yet" },
];

const pending = new Set(plannedPages.map((p) => p.href));

/** True while the page a link points to is not built (query strings and anchors ignored). */
export function isPlanned(href: string): boolean {
  return pending.has(href.split(/[?#]/)[0]);
}

/** The links whose page exists. */
export function builtOnly<T extends { href: string }>(links: readonly T[]): T[] {
  return links.filter((link) => !isPlanned(link.href));
}

/** The link, or null while its page is not built. */
export function builtOrNull<T extends { href: string }>(link: T): T | null {
  return isPlanned(link.href) ? null : link;
}
