import { monthlyCourses, type CourseId, type ProgramId } from "./pricing";

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
 * Instructor slugs that changed (owner, 21 Nov 2026: these two teachers are
 * written with no title). Old slug → new slug, each a 301.
 */
export const renamedInstructorSlugs: Record<string, string> = {
  "ustadha-najiba-mahzabin-jeba": "najiba-mahzabin-jeba",
  "ustadha-maha-rashed": "maha-rashed",
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
  "/instructor/alauddin-khilzi": "ustad-alauddin-khilzi",
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

export function instructorSlugRedirects() {
  return [
    ...Object.entries(renamedInstructorSlugs).map(([from, to]) => ({
      source: `/instructors/${from}`,
      destination: `/instructors/${to}`,
      statusCode: 301 as const,
    })),
    // Every live profile to its own new profile, before the catch-all below.
    ...Object.entries(liveInstructorPaths).map(([from, to]) => ({
      source: from,
      destination: `/instructors/${to}`,
      statusCode: 301 as const,
    })),
    // Anything else under /instructor/ (an unknown or future slug) goes to the
    // directory, never to a 404 (owner plan, 22 Nov 2026). The live directory moves too.
    { source: "/instructor/:slug", destination: "/instructors", statusCode: 301 as const },
    { source: "/instructor", destination: "/instructors", statusCode: 301 as const },
  ];
}

/**
 * 301s from the live course paths to the new course pages. Programs are
 * added when their pages are built. Next.js drops the
 * trailing slash first, so the source has none.
 */
export function legacyCourseRedirects() {
  return monthlyCourses.flatMap((course) => {
    const from = livePaths[course.id]?.replace(/\/$/, "");
    return from ? [{ source: from, destination: course.href, statusCode: 301 as const }] : [];
  });
}
