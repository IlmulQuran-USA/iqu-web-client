import { liveAttachments, liveContent } from "./legacy-inventory.ts";
import { portalEnabled } from "../lib/site-env.ts";
import { isPlanned } from "./planned-pages.ts";
import { monthlyCourses, programs, type CourseId, type ProgramId } from "./pricing.ts";

/*
 * The live WordPress paths of each course and program (COURSE-CONTENT.md
 * §3–§9; §11 C6: every live URL gets a 301 to its new slug at launch). null
 * when there is no live page. Kept free of other content imports so
 * next.config.ts can read it for the redirects; ./courses reads it too, so
 * there is one source.
 */
export const livePaths: Record<CourseId | ProgramId, string | null> = {
  "noorani-qaidah": "/course/nurani-qaida-for-kids/",
  "quran-nazirah": "/course/quran-nazirah/",
  "quran-hifz": "/course/quran-memorization/",
  "quranic-arabic-level-1": "/course/quranic-arabic-mastery-level-1/",
  "tarjumatul-quran": null,
  "islamic-studies": null,
  "weekend-ilm-program": "/course/weekend-ilm-program/",
  // Live name: Summer Islamic Education Program.
  "summer-ilm-camp": "/course/summer-islamic-education-program/",
};

/**
 * Instructor slugs that changed because the teacher is now written with no
 * title (owner, 21 and 22 Nov 2026). Old slug → new slug, each a 301.
 */
export const renamedInstructorSlugs: Record<string, string> = {
  "ustadha-najiba-mahzabin-jeba": "najiba-mahzabin-jeba",
  "ustadha-maha-rashed": "maha-rashed",
  // Owner, 22 Nov 2026: Alauddin Khilzi, written with no title too.
  "ustad-alauddin-khilzi": "alauddin-khilzi",
};

/**
 * Every live WordPress instructor profile (the 20 `iq_instructor` posts,
 * read-only from ilmulquranus.org on 22 Nov 2026; permalinks are
 * /instructor/<slug>/), each to its own new profile. Old path (no trailing
 * slash) → new slug. Matched by the post title, not the slug: three live
 * slugs name the wrong teacher (COURSE-CONTENT.md §11, C6).
 */
export const liveInstructorPaths: Record<string, string> = {
  // The three wrong live slugs (C6).
  "/instructor/sheikh-hussain-muhammad": "mawlana-nazrul-islam",
  "/instructor/mufti-harun-izhar": "mufti-jubayer-bin-jalaluddin",
  "/instructor/muhamad-raiyan": "mufti-ahmed-mostafa-raian",
  // Live slug differs from the new one.
  "/instructor/shaker-waliullah": "mufti-shaker-waliullah",
  "/instructor/alauddin-khilzi": "alauddin-khilzi",
  "/instructor/humayra-afrin": "hafezah-humayra-afrin",
  "/instructor/muhammad-nurul-ahsan": "hafez-nurul-ahsan",
  "/instructor/muhammad-faijullah": "mufti-muhammad-faijullah",
  "/instructor/nuha-rashed": "hafezah-nuha-rashed",
  // Same slug, new path (/instructor/ → /instructors/).
  "/instructor/mufti-shamsuddin-rois": "mufti-shamsuddin-rois",
  "/instructor/mufti-mushfiqur-rahman": "mufti-mushfiqur-rahman",
  "/instructor/mufti-ariful-islam": "mufti-ariful-islam",
  "/instructor/mawlana-mouinul-islam": "mawlana-mouinul-islam",
  "/instructor/najiba-mahzabin-jeba": "najiba-mahzabin-jeba",
  "/instructor/maha-rashed": "maha-rashed",
  "/instructor/jawadul-islam-khan-jami": "jawadul-islam-khan-jami",
  "/instructor/mufti-sajidullah": "mufti-sajidullah",
  "/instructor/afra-humayra": "afra-humayra",
  "/instructor/shifa-jalal": "shifa-jalal",
  "/instructor/mufti-muaj-al-juhany": "mufti-muaj-al-juhany",
};

/*
 * Each live profile goes to its own new profile, and a renamed new slug to its
 * current one (legacyRedirectMap below). Anything else under /instructor/ (an
 * unknown or future slug) goes to the directory, never to a 404 (owner plan,
 * 22 Nov 2026): the /instructor namespace rule in src/lib/legacy-redirect.ts.
 */

/**
 * Other live paths that move to a program page (spec §7.0 route map: "/summer-program
 * → /programs/summer-ilm-camp"; owner, 23 Nov 2026). The live Summer Program
 * page hosts the summer form today.
 */
const programPagePaths: Record<string, ProgramId> = {
  "/summer-program": "summer-ilm-camp",
};

/**
 * 301s from the live course and program paths to the new pages. Next.js
 * drops the trailing slash first, so the source has none.
 */
export function legacyCourseRedirects() {
  const items: { id: CourseId | ProgramId; href: string }[] = [
    ...monthlyCourses,
    ...Object.values(programs).map((p) => ({ id: p.id, href: p.href })),
  ];
  return [
    ...items.flatMap((item) => {
      const from = livePaths[item.id]?.replace(/\/$/, "");
      return from ? [{ source: from, destination: item.href, statusCode: 301 as const }] : [];
    }),
    ...Object.entries(programPagePaths).map(([from, id]) => ({
      source: from,
      destination: Object.values(programs).find((p) => p.id === id)!.href,
      statusCode: 301 as const,
    })),
  ];
}

/**
 * The live WordPress policy pages (read-only via Novamira, 26 Nov 2026: pages
 * 3, 443 and 1366; no old slugs, no Rank Math redirects), each to its
 * /legal/* page (the footer's links, spec §6.2). Complianz has no pages of
 * its own: its cookie statement links to /privacy-policy/. Next.js drops the
 * trailing slash first, so the source has none.
 */
export const livePolicyPaths: Record<string, string> = {
  "/privacy-policy": "/legal/privacy",
  "/terms-and-conditions": "/legal/terms",
  "/tuition-refund-policy": "/legal/refund",
};

export function legalRedirects() {
  return Object.entries(livePolicyPaths).map(([source, destination]) => ({ source, destination, statusCode: 301 as const }));
}

/* ── The full redirect map for the domain switch (owner, 27 Nov 2026) ──────
 *
 * Every public URL of the live WordPress site (inventory, read-only, 27 Nov
 * 2026: F:/iqu-setup/reports/seo-parity.md) maps to its best new page. The
 * proxy answers each one in ONE 301 hop, with or without the trailing slash
 * WordPress used (src/lib/legacy-redirect.ts). Paths are written without the
 * trailing slash. A target is always a final URL: never itself redirected.
 */

/** A planned page while it is not built yet, then the page itself (planned-pages.ts). */
const builtOr = (href: string, fallback: string) => (isPlanned(href) ? fallback : href);

/** Every published WordPress page (19, plus /home and the Rank Math redirect for /sample-page). */
export const livePagePaths: Record<string, string> = {
  "/": "/",
  "/home": "/", // the front page's own slug; WordPress sends it to /
  "/sample-page": "/", // Rank Math redirect #1 (89 hits)
  "/about": "/about",
  "/courses": "/courses",
  "/instructors": "/instructors",
  "/contact": "/contact",
  "/donate": "/donate",
  "/enroll": "/enroll", // the old newsletter page (noindex on live); the form lives here now
  "/enroll-for-free": "/enroll",
  "/student-registration": "/enroll",
  "/weekend-program": "/programs/weekend-ilm-program",
  // No results page yet (spec "camp results"): the camp's own page is the closest parent.
  "/summer-program-results": "/programs/summer-ilm-camp",
  // Leftover shop pages (noindex on live): a family there was choosing a course.
  "/cart": "/courses",
  "/checkout": "/courses",
  "/instructor-registration": builtOr("/teach", "/contact"),
  // The live LMS dashboard (noindex): the portal's sign-in where the portal is open, otherwise how to reach the team.
  "/dashboard": portalEnabled() ? "/login" : "/contact",
  ...livePolicyPaths,
};

/** Archives, feeds and author pages: no equivalent, so the closest parent page. */
export const liveArchivePaths: Record<string, string> = {
  "/course": "/courses",
  "/instructor": "/instructors",
  "/ilm_ul_quran_course_cats": "/courses",
  "/ilm_ul_quran_course_cats/adults": "/courses",
  "/ilm_ul_quran_course_cats/female": "/courses",
  "/ilm_ul_quran_course_cats/kids": "/courses",
  "/ilm_ul_quran_course_cats/male": "/courses",
  "/ilm_ul_quran_course_cats/popular": "/courses",
  "/ilm_ul_quran_course_cats/quran": "/courses",
  "/iq_instructor_cats": "/instructors",
  "/iq_instructor_cats/female": "/instructors",
  "/iq_instructor_cats/male": "/instructors",
  "/iq_instructor_cats/home-page-teachers": "/instructors",
  // Empty post categories (noindex on live): the blog once it exists; nothing else fits until then.
  "/category": builtOr("/blog", "/"),
  "/category/quran": builtOr("/blog", "/"),
  "/category/ramadan": builtOr("/blog", "/"),
  "/category/salaat": builtOr("/blog", "/"),
  "/category/social-work": builtOr("/blog", "/"),
  "/category/uncategorized": builtOr("/blog", "/"),
  // The two author archives belong to two teachers: their profiles.
  "/author/faijullah": "/instructors/mufti-muhammad-faijullah",
  "/author/nurulahsan": "/instructors/hafez-nurul-ahsan",
  "/feed": "/",
  "/feed/json": "/",
  "/comments/feed": "/",
  "/course/feed": "/courses",
  "/instructor/feed": "/instructors",
};

/** Misses in the live 404 log (Rank Math, 27 Nov 2026) that have an obvious home. */
export const live404Fixes: Record<string, string> = {
  "/contact-us": "/contact",
  "/contactus": "/contact",
  "/register": "/enroll",
  "/registration": "/enroll",
  "/blog": builtOr("/blog", "/"),
  "/teach-with-us": builtOr("/teach", "/contact"),
  "/careers": builtOr("/teach", "/contact"),
  "/join-us": builtOr("/teach", "/contact"),
  "/about/null": "/about",
};

/**
 * The live file-like URLs, for next.config.ts (the proxy never sees paths
 * with a dot): Rank Math's sitemaps → /sitemap.xml on the public site only
 * (staging serves no sitemap), and Rank Math redirect #2, the
 * apple-touch-icon variants (40 hits) → the site's Apple icon.
 */
export const liveSitemapPaths = [
  "/sitemap_index.xml",
  "/page-sitemap.xml",
  "/post-sitemap.xml",
  "/ilm_ul_quran_course-sitemap.xml",
  "/iq_instructor-sitemap.xml",
  "/category-sitemap.xml",
  "/author-sitemap.xml",
  "/wp-sitemap.xml",
] as const;

/**
 * With WordPress moved to its own host (owner, 27 Nov 2026; WP_ORIGIN, set on
 * the public site only: src/lib/site-env.ts wpOrigin), its media and its
 * login page follow it, path for path: an old image link or a shared preview
 * keeps working. null: no WordPress host, so no rule.
 */
export function wordpressFileRedirects(wpOrigin: string | null) {
  if (!wpOrigin) return [];
  return [
    { source: "/wp-content/uploads/:path*", destination: `${wpOrigin}/wp-content/uploads/:path*`, statusCode: 301 as const },
    { source: "/wp-login.php", destination: `${wpOrigin}/wp-login.php`, statusCode: 301 as const },
  ];
}

export function fileRedirects(production: boolean, wpOrigin: string | null = null) {
  return [
    ...wordpressFileRedirects(production ? wpOrigin : null),
    ...(production ? liveSitemapPaths.map((source) => ({ source, destination: "/sitemap.xml", statusCode: 301 as const })) : []),
    {
      source: "/:icon(apple-touch-icon(?:-precomposed|-\\d+x\\d+(?:-precomposed)?)?\\.png)",
      destination: "/apple-icon.png",
      statusCode: 301 as const,
    },
  ];
}

/** Live course, program and instructor paths, as path → new page. */
function contentPaths(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of legacyCourseRedirects()) out[r.source] = r.destination;
  for (const [from, to] of Object.entries(liveInstructorPaths)) out[from] = `/instructors/${to}`;
  for (const [from, to] of Object.entries(renamedInstructorSlugs)) out[`/instructors/${from}`] = `/instructors/${to}`;
  return out;
}

let cache: { paths: Map<string, string>; ids: Map<number, string> } | null = null;

/**
 * The whole map: live path → new page, and WordPress ID → new page (for
 * /?p=…, /?page_id=… and /?attachment_id=… links). Attachment pages follow
 * their parent (Rank Math redirected them to it on live); an attachment with
 * no public parent goes home, as on live (attachment_redirect_default).
 */
export function legacyRedirectMap() {
  if (cache) return cache;
  const paths = new Map<string, string>(Object.entries({ ...contentPaths(), ...livePagePaths, ...liveArchivePaths, ...live404Fixes }));
  const ids = new Map<number, string>();
  for (const [id, , path] of liveContent) {
    const to = paths.get(path);
    if (!to) throw new Error(`Live ${path} (WordPress ID ${id}) has no new page: add it to src/content/legacy-paths.ts`);
    ids.set(id, to);
  }
  const byId = new Map(liveAttachments.map((a) => [a[0], a] as const));
  const targetOf = (id: number, depth = 0): string => {
    if (ids.has(id)) return ids.get(id)!;
    const att = byId.get(id);
    return att && att[2] && depth < 5 ? targetOf(att[2], depth + 1) : "/";
  };
  for (const [id, path, parent] of liveAttachments) {
    const to = parent ? targetOf(parent) : "/";
    ids.set(id, to);
    if (!path.includes("?")) paths.set(path, to);
  }
  cache = { paths, ids };
  return cache;
}
