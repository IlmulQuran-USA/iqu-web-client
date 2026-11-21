import { z } from "zod";
import { wholePhraseIndex } from "@/lib/text";

/*
 * Content models for editable public content. Each schema is the contract
 * between whatever stores the content (today a file in src/content, later the
 * admin settings store) and the components that render it. The limits exist
 * so that no layout can break, whatever an editor types.
 */

/* ── Copy status (owner, 20 Nov 2026) ───────────────────────────────────── */

/**
 * Every text carried over from docs/spec/COURSE-CONTENT.md says how far it is
 * approved:
 *   live     the owner's own wording (lightly edited for grammar and US English)
 *   draft    written to fill a gap; the owner must approve it before launch
 *   pending  not supplied yet; the value is empty and nothing is invented
 * `npm run content:check` lists every draft and pending item.
 */
/**
 * sample  placeholder content shown for admin review (owner, 21 Nov 2026). It
 *         renders everywhere, with no badge; content:check lists it as a
 *         warning to replace or confirm before the public launch.
 */
export const COPY_STATUSES = ["live", "draft", "pending", "sample"] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];
const approved = z.enum(["live", "draft", "sample"]);
const pendingStatus = z.literal("pending");

/** One paragraph or sentence. */
export const copyTextSchema = z.union([
  z.object({ status: approved, text: z.string().trim().min(1) }),
  z.object({ status: pendingStatus, text: z.null() }),
]);
export type CopyText = z.infer<typeof copyTextSchema>;

/** A list of short items (highlights, qualifications, schedule lines). */
export const copyListSchema = z.union([
  z.object({ status: approved, items: z.array(z.string().trim().min(1)).min(1) }),
  z.object({ status: pendingStatus, items: z.array(z.string()).max(0) }),
]);
export type CopyList = z.infer<typeof copyListSchema>;

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase-hyphenated slug");

/* ── Instructors ─────────────────────────────────────────────────────────── */

export const LANGUAGES = ["English", "Bengali", "Arabic", "Urdu"] as const;
export type Language = (typeof LANGUAGES)[number];

export const instructorSchema = z
  .object({
    /** URL slug (COURSE-CONTENT.md §10). Never the old site's instructor URL. */
    id: slugSchema,
    /** Full name including its title ("Mufti …", "Hafez …"), exactly as COURSE-CONTENT.md §10 writes it. */
    name: z.string().min(1).max(60),
    /** Brothers learn with male teachers; sisters, and boys up to age 10, can learn with a female teacher (owner, 20 Nov 2026). */
    gender: z.enum(["male", "female"]),
    /**
     * Short caption under the name on cards. Never repeats the title that is
     * already in the name. At most 24 characters so it stays within two lines
     * on a 375 px three-up row.
     */
    role: z.string().trim().min(1).max(24),
    /** Full wording of the role, for the instructor profile page. */
    roleFull: copyTextSchema,
    /** The languages this teacher teaches in. */
    languages: z.array(z.enum(LANGUAGES)).min(1),
    /** Profile text, in full sentences. */
    bio: copyTextSchema,
    qualifications: copyListSchema,
    /** The live profile is noindex: keep it out of search until the owner says otherwise. */
    noindex: z.literal(true).optional(),
    /**
     * A recitation recording (spec §7.5 section 5). Optional: the profile shows a
     * Recitation section only when this is set (owner, 22 Nov 2026). Self-hosted
     * under public/instructors/audio/.
     */
    recitationAudio: z
      .object({
        src: z.string().startsWith("/instructors/audio/"),
        /** What is recited, with its citation, e.g. "Surah Ar-Rahman 55:1–16". */
        title: z.string().trim().min(1).max(80),
        durationSeconds: z.number().int().positive().max(600),
        status: approved,
      })
      .optional(),
    /**
     * Certificates and ijazahs as the owner supplies them. Optional: the profile
     * shows a Certificates section only when this is set (owner, 22 Nov 2026).
     * Never invented: no year or issuer unless the document gives it.
     */
    certificates: z
      .object({
        status: approved,
        items: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(120),
              issuer: z.string().trim().min(1).max(120).optional(),
              year: z.number().int().min(1950).max(2100).optional(),
            }),
          )
          .min(1),
      })
      .optional(),
    /** A conflict in this record for the owner to resolve. Never rendered; listed by content:check. */
    dataNote: z.object({ status: z.literal("draft"), text: z.string().trim().min(1) }).optional(),
    /** Square portrait in public/instructors/; null keeps the arch monogram. */
    photo: z
      .object({
        src: z.string().startsWith("/instructors/"),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        /** The framing differs from the hero set (eyes at 35%, same face size): re-frame when a better original exists. Listed by content:check. */
        reframe: z.literal(true).optional(),
      })
      .nullable(),
  })
  // Female teachers never show a photo: the live images are shared placeholders (COURSE-CONTENT.md §10).
  .refine((p) => p.gender === "male" || p.photo === null, {
    message: "a female teacher has no photo",
    path: ["photo"],
  });
export type Instructor = z.infer<typeof instructorSchema>;

/* ── Courses and programs (COURSE-CONTENT.md §1–§9) ──────────────────────── */

/** A curriculum or teaching method. Its shape follows the owner's source. */
export const curriculumSchema = z.discriminatedUnion("kind", [
  /** Numbered class plan with checkpoints (Noorani Qaidah's 48 classes). */
  z.object({
    kind: z.literal("classPlan"),
    status: approved,
    rows: z.array(z.object({ classes: z.string(), focus: z.string(), checkpoint: z.string() })).min(1),
  }),
  /** Ordered steps or parts, each with a title and a sentence. */
  z.object({
    kind: z.literal("steps"),
    status: approved,
    steps: z.array(z.object({ title: z.string().min(1), text: z.string().min(1) })).min(1),
  }),
  /** Phases with a goal, topics and practice (Quranic Arabic Mastery). */
  z.object({
    kind: z.literal("phases"),
    status: approved,
    phases: z
      .array(
        z.object({
          title: z.string().min(1),
          months: z.string().min(1),
          goal: z.string().min(1),
          topics: z.array(z.string().min(1)).min(1),
          practice: z.string().min(1),
        }),
      )
      .min(1),
  }),
  /** Topic groups, each a heading and a list (programs). */
  z.object({
    kind: z.literal("topics"),
    status: approved,
    groups: z.array(z.object({ title: z.string().min(1), items: z.array(z.string().min(1)).min(1) })).min(1),
  }),
  /** Not supplied yet. */
  z.object({ kind: z.literal("pending"), status: pendingStatus }),
]);
export type Curriculum = z.infer<typeof curriculumSchema>;

/**
 * The copy for one course or program. Its name, slug and prices are not here:
 * they come from src/content/pricing.ts, matched by id. Builds the schema
 * against the instructor list, so teachers can only be chosen by id.
 */
export function courseContentSchema(instructorIds: readonly string[]) {
  const ids = new Set(instructorIds);
  const teacherId = z.string().refine((id) => ids.has(id), { message: "not in the instructor list" });
  return z.object({
    id: slugSchema,
    /** The live WordPress path, for the 301 at launch (COURSE-CONTENT.md §11, C6); null when there is none. */
    livePath: z.string().startsWith("/").nullable(),
    /** A course for adults: its page addresses the student as "you", never "your child" (owner, 20 Nov 2026). */
    forAdults: z.literal(true).optional(),
    /** Keep the page out of search and the sitemap until its content is live. */
    noindex: z.literal(true).optional(),
    /** Meta description. */
    meta: copyTextSchema,
    overview: copyTextSchema,
    /** Who it's for. */
    audience: copyTextSchema.optional(),
    /** Where it sits in the learning path, or what it covers. */
    placement: copyTextSchema.optional(),
    /** The course's aim. Never presented as a guarantee. */
    objective: copyTextSchema.optional(),
    /** Length of the whole course, when it has one ("48 classes", "One year"). */
    duration: copyTextSchema.optional(),
    /** Fixed schedule, ages and dates. */
    schedule: copyListSchema.optional(),
    highlights: copyListSchema.optional(),
    curriculum: curriculumSchema.optional(),
    /** How it is taught, as ordered steps or parts. */
    method: curriculumSchema.optional(),
    /** How it is taught, as a plain list. */
    teaching: copyListSchema.optional(),
    /** A path through the course, in order. */
    path: copyListSchema.optional(),
    assessment: copyListSchema.optional(),
    outcomes: copyListSchema.optional(),
    support: copyTextSchema.optional(),
    note: copyTextSchema.optional(),
    certificate: z.union([
      z.object({ status: approved, value: z.boolean() }),
      z.object({ status: pendingStatus, value: z.null() }),
    ]),
    /** The course that usually follows (COURSE-CONTENT.md §1 learning path). */
    nextStepId: slugSchema.optional(),
    /** Teachers listed on the live course page, by instructor id. */
    teachers: z.union([
      z.object({ status: approved, ids: z.array(teacherId).min(1) }),
      z.object({ status: pendingStatus, ids: z.array(z.string()).max(0) }),
    ]),
    /**
     * Teachers added from their own profiles (COURSE-CONTENT.md §10), not
     * from the live course page: always draft until the owner confirms them.
     */
    profileTeachers: z.object({ status: z.literal("draft"), ids: z.array(teacherId).min(1) }).optional(),
  });
}
export type CourseContent = z.infer<ReturnType<typeof courseContentSchema>>;

/* ── Home hero (spec §7.1 section 1; PRODUCT.md owner decision 5) ──────── */

export const HOME_HERO_LAYOUTS = ["editorial", "teachers", "spacious"] as const;
export type HomeHeroLayout = (typeof HOME_HERO_LAYOUTS)[number];

export const HOME_HERO_LIMITS = {
  /** Not one of the owner's four limits: keeps the uppercase eyebrow to two lines at 375. */
  eyebrow: 64,
  headline: 70,
  subhead: 180,
  ctaLabel: 24,
  trustItems: 4,
  trustItem: 40,
  featuredInstructors: 5,
} as const;

const ctaSchema = z.object({
  label: z.string().trim().min(1).max(HOME_HERO_LIMITS.ctaLabel),
  /** Internal path ("/enroll") or absolute https URL. */
  href: z.string().regex(/^(\/(?!\/)|https:\/\/)/, "an internal path or an https URL"),
});

/**
 * Builds the schema against the instructor list, so featured instructors can
 * only be chosen from it by id: never free-typed names.
 */
export function homeHeroSchema(instructorIds: readonly string[]) {
  const ids = new Set(instructorIds);
  return z
    .object({
      layout: z.enum(HOME_HERO_LAYOUTS),
      eyebrow: z.string().trim().min(1).max(HOME_HERO_LIMITS.eyebrow),
      headline: z.string().trim().min(1).max(HOME_HERO_LIMITS.headline),
      /** A phrase inside the headline, set on --mark. Optional. */
      highlight: z.string().trim().min(1).optional(),
      subhead: z.string().trim().min(1).max(HOME_HERO_LIMITS.subhead),
      primaryCta: ctaSchema,
      secondaryCta: ctaSchema,
      trust: z.array(z.string().trim().min(1).max(HOME_HERO_LIMITS.trustItem)).max(HOME_HERO_LIMITS.trustItems),
      image: z.object({
        /** A real class photograph (spec §8); never stock. */
        src: z.string().min(1),
        alt: z.string().trim().min(1, "alt text is required"),
        /** Explicit dimensions are mandatory for the CLS-critical hero image (CLAUDE.md §4). */
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        /** Point kept in view when the arch crops the photo, in % of width and height. */
        focalPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
        /** Optional LQIP for the blur placeholder. */
        blurDataURL: z.string().startsWith("data:image/").optional(),
      }),
      featuredInstructorIds: z
        .array(z.string().refine((id) => ids.has(id), { message: "not in the instructor list" }))
        .max(HOME_HERO_LIMITS.featuredInstructors)
        .refine((list) => new Set(list).size === list.length, { message: "duplicate instructor" }),
    })
    .refine((hero) => !hero.highlight || wholePhraseIndex(hero.headline, hero.highlight) !== -1, {
      message: "highlight must be whole words from the headline",
      path: ["highlight"],
    });
}

/** What an editor supplies. */
export type HomeHeroContent = z.infer<ReturnType<typeof homeHeroSchema>>;

/** What getHomeHero() returns: validated content with featured ids resolved, in order. */
export type HomeHero = HomeHeroContent & { featuredInstructors: Instructor[] };
