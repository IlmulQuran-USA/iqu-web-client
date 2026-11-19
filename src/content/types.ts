import { z } from "zod";
import { wholePhraseIndex } from "@/lib/text";

/*
 * Content models for editable public content. Each schema is the contract
 * between whatever stores the content (today a file in src/content, later the
 * admin settings store) and the components that render it. The limits exist
 * so that no layout can break, whatever an editor types.
 */

/* ── Instructors ─────────────────────────────────────────────────────────── */

export const instructorSchema = z.object({
  /** URL slug, made from the name. Never the old site's instructor URL. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase-hyphenated slug"),
  /** Full name including its title ("Mufti …", "Hafez …"), as the owner writes it. */
  name: z.string().min(1).max(60),
  /**
   * Short caption under the name on cards. Never repeats the title that is
   * already in the name. At most 24 characters so it stays within two lines
   * on a 375 px three-up row.
   */
  role: z.string().trim().min(1).max(24),
  /** Full wording of the role, for the instructor profile page. */
  roleFull: z.string().trim().min(1),
  /** Square portrait in public/instructors/; null keeps the arch monogram. */
  photo: z
    .object({
      src: z.string().startsWith("/instructors/"),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable(),
});
export type Instructor = z.infer<typeof instructorSchema>;

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
