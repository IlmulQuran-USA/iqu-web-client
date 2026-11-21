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
 * Live WordPress instructor profiles whose slug does not match the teacher
 * (COURSE-CONTENT.md §11, C6). Old path (no trailing slash) → new slug.
 */
export const wrongLiveInstructorPaths: Record<string, string> = {
  "/instructor/sheikh-hussain-muhammad": "mawlana-nazrul-islam",
  "/instructor/mufti-harun-izhar": "mufti-jubayer-bin-jalaluddin",
  "/instructor/muhamad-raiyan": "mufti-ahmed-mostafa-raian",
};

export function instructorSlugRedirects() {
  return [
    ...Object.entries(renamedInstructorSlugs).map(([from, to]) => ({
      source: `/instructors/${from}`,
      destination: `/instructors/${to}`,
      statusCode: 301 as const,
    })),
    // The three wrong live slugs first, so the catch-all below never takes them.
    ...Object.entries(wrongLiveInstructorPaths).map(([from, to]) => ({
      source: from,
      destination: `/instructors/${to}`,
      statusCode: 301 as const,
    })),
    // The other live profile URLs are not documented: send them to the directory,
    // never to a 404 (owner plan, 22 Nov 2026). The live directory moves too.
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
