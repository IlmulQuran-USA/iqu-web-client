import { catalogGroups, catalogRowFor, finalCtaFor, type CatalogRow } from "./catalog";
import { draft } from "./copy";
import { ctas, teacherGroups } from "./course-page";
import { courseFaq, courseRules, courses, programList, teacherMatching } from "./courses";
import { faq as homeFaq, teachersSection } from "./home";
import { instructors } from "./instructors";
import { site } from "./site";
import { LANGUAGES, type Instructor, type Language } from "./types";

/*
 * Instructor directory (/instructors, spec §7.4) and profiles
 * (/instructors/[slug], spec §7.5); plan approved by the owner, 22 Nov 2026.
 * Every fact comes from ./instructors and the course and program teacher
 * lists in ./courses; this file only arranges it. New wording is draft so
 * `npm run content:check` lists it.
 *
 * Never shown (COURSE-CONTENT.md §11; owner, 22 Nov 2026): ratings, reviews,
 * stars, student counts, years of experience, "Popular courses" or anything
 * like it. Pending fields are not rendered. Female teachers never show a
 * photo (enforced by the schema).
 */

/* ── Who teaches what ────────────────────────────────────────────────────── */

export type Offering = { id: string; row: CatalogRow; kind: "course" | "program"; status: "live" | "draft" };

/** Every course and program a teacher is listed on, in catalog order, from the live list or a draft list. */
export function offeringsOf(person: Instructor): Offering[] {
  const all = [
    ...courses.map((c) => ({ id: c.id, kind: "course" as const, content: c.content })),
    ...programList.map((p) => ({ id: p.id, kind: "program" as const, content: p.content })),
  ];
  const order = catalogGroups.flatMap((g) => g.rows.map((r) => r.id));
  return all
    .flatMap(({ id, kind, content }) => {
      const { teachers, profileTeachers } = content;
      const onLive = teachers.status !== "pending" && teachers.ids.includes(person.id);
      const onDraft = profileTeachers?.ids.includes(person.id) ?? false;
      if (!onLive && !onDraft) return [];
      const row = catalogRowFor(id);
      if (!row) throw new Error(`No catalog row for ${id}`);
      const status = onLive && teachers.status === "live" ? ("live" as const) : ("draft" as const);
      return [{ id, row, kind, status }];
    })
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/* ── Directory ───────────────────────────────────────────────────────────── */

export const directoryHeader = {
  id: "directory-header",
  title: "Our teachers",
  // COURSE-CONTENT.md §1 (live, owner's wording 20 Nov 2026).
  intro: courseRules.teacherAssignment.text,
  // Counted from ./instructors (Home §5's approved facts line).
  facts: teachersSection.facts,
} as const;

export const directoryMeta = {
  title: "Our Teachers",
  description: `Meet our ${instructors.length} teachers: Muftis, Huffaz and Ulama teaching the Quran and Islamic studies live on Zoom, in ${listOf([...LANGUAGES])}.`,
} as const;

/** The courses and programs that have at least one teacher, in catalog order: the course filter's options. */
export const courseOptions = catalogGroups
  .flatMap((g) => g.rows)
  .filter((row) => instructors.some((p) => offeringsOf(p).some((o) => o.id === row.id)))
  .map((row) => ({ id: row.id, label: row.name }));

export const languageOptions: readonly Language[] = LANGUAGES;

export type DirectoryFilter = { course: string | null; lang: Language | null };

/** Unknown values are ignored, so a bad link shows everyone. */
export function directoryFilter(params: { course?: string | string[]; lang?: string | string[] }): DirectoryFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const course = one(params.course);
  const lang = one(params.lang);
  return {
    course: courseOptions.some((o) => o.id === course) ? course! : null,
    lang: languageOptions.find((l) => l.toLowerCase() === lang?.toLowerCase()) ?? null,
  };
}

export function filterHref({ course, lang }: DirectoryFilter): string {
  const q = new URLSearchParams();
  if (course) q.set("course", course);
  if (lang) q.set("lang", lang.toLowerCase());
  const s = q.toString();
  return s ? `/instructors?${s}` : "/instructors";
}

export function matches(person: Instructor, { course, lang }: DirectoryFilter): boolean {
  return (!course || offeringsOf(person).some((o) => o.id === course)) && (!lang || person.languages.includes(lang));
}

/** COURSE-CONTENT.md §10 "Leadership", shown first and larger in the brothers group when no filter is set. */
export const leadershipIds = ["mufti-muhammad-faijullah", "mufti-ahmed-mostafa-raian", "hafez-nurul-ahsan"] as const;

export const directoryGroups = teacherGroups.map((group) => ({
  ...group,
  // On the directory the empty text names the filter, not "this course".
  empty: (label: string) =>
    group.gender === "male"
      ? `No male teacher is listed for ${label} yet.`
      : `No female teacher is listed for ${label} yet.`,
}));

export const directoryCopy = {
  filterLabels: { course: "Course", language: "Language", any: "Any", allCourses: "All courses", apply: "Show" },
  showing: (n: number) => `Showing ${n} of ${instructors.length}`,
  clear: "Clear filters",
  leadership: "Leadership",
  emptyAll: (what: string) => `No teacher is listed for ${what} yet. Ask us and we’ll tell you the options.`,
  ask: { label: "Ask a question", href: "/contact" },
} as const;

/** How matching works: the draft matching line, then two live questions. */
export const matching = {
  id: "matching",
  heading: "How we match a teacher",
  text: teacherMatching,
  items: [
    courseFaq[0],
    (() => {
      const item = homeFaq.items.find((i) => i.q === "What times are classes?");
      if (!item) throw new Error('The Home FAQ no longer has "What times are classes?"');
      return item;
    })(),
  ],
} as const;

/** Spec §7.4 section 5: recruitment, as a quiet text row (the page has one filled button). */
export const teachWithUs = {
  text: draft("Are you a qualified Quran teacher? We are always glad to hear from teachers."),
  link: { label: "Teach with us", href: "/teach" },
} as const;

/* ── Profile ─────────────────────────────────────────────────────────────── */

/** The card caption, or the full role where the owner supplied one. */
export function roleOf(person: Instructor): string {
  return person.roleFull.status === "pending" ? person.role : person.roleFull.text;
}

/** Search description: the bio's first sentence, cut at a word to 160 characters. */
export function profileDescription(person: Instructor): string {
  const bio = person.bio.status === "pending" ? null : person.bio.text;
  const first = bio?.split(/(?<=\.)\s/)[0] ?? `${person.name}, ${roleOf(person)} at ${site.name}.`;
  if (first.length <= 160) return first;
  const cut = first.slice(0, 159);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * The one next step (owner plan, 22 Nov 2026). A course: enrol in the first
 * course they teach, in catalog order, with the course pre-filled (the family
 * is matched to a teacher; the teacher is not pre-filled). Programs only: the
 * programs call to action. Nothing listed: a link to the catalog.
 */
export function nextStepOf(person: Instructor) {
  const offerings = offeringsOf(person);
  const course = offerings.find((o) => o.kind === "course");
  if (course) {
    const enrol = ctas(courses.find((c) => c.id === course.id)!).enrol;
    return { kind: "course" as const, label: enrol.label, href: enrol.href, final: finalCtaFor("course", enrol.href) };
  }
  const program = offerings.find((o) => o.kind === "program");
  if (program) {
    const final = finalCtaFor("program", program.row.href);
    return { kind: "program" as const, label: final.button.label, href: program.row.href, final };
  }
  return { kind: "none" as const, label: "See all courses", href: "/courses", final: finalCtaFor("course") };
}

export const profileCopy = {
  languages: "Teaches in",
  teaches: "Teaches",
  about: "About",
  qualifications: "Qualifications",
  certificates: "Certificates",
  recitation: "Recitation",
  courses: "Courses taught",
  coursesIntro: draft("Each course page has the schedule, the fees and how to enroll."),
  noCourses: draft("No course is listed for this teacher yet. See all courses, or ask us."),
  // The matching rule under the button (draft), so the button is not read as booking this teacher.
  matchingNote: teacherMatching,
  others: (labels: string[]) => `Also teaching ${listOf(labels)}`,
} as const;

/**
 * Up to five other teachers listed on any of the same courses or programs,
 * in the same group (brothers or sisters), most shared offerings first.
 */
export function othersLike(person: Instructor): { people: Instructor[]; labels: string[] } {
  const mine = offeringsOf(person);
  const ids = new Set(mine.map((o) => o.id));
  const people = instructors
    .filter((p) => p.id !== person.id && p.gender === person.gender)
    .map((p) => ({ p, shared: offeringsOf(p).filter((o) => ids.has(o.id)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 5)
    .map((x) => x.p);
  return { people, labels: mine.slice(0, 2).map((o) => o.row.name) };
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
