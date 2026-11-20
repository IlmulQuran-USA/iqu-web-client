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
 * 301s from the live course paths to the new course pages. Programs and
 * instructors are added when their pages are built. Next.js drops the
 * trailing slash first, so the source has none.
 */
export function legacyCourseRedirects() {
  return monthlyCourses.flatMap((course) => {
    const from = livePaths[course.id]?.replace(/\/$/, "");
    return from ? [{ source: from, destination: course.href, statusCode: 301 as const }] : [];
  });
}
