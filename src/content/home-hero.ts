import type { HomeHeroContent } from "./types";

/*
 * The Home hero (spec §7.1 section 1). This file is the only place the hero
 * is changed until the admin settings page /a/settings/home exists
 * (PRODUCT.md owner decision 5). Pages never import it: they call
 * getHomeHero() in src/lib/content, which validates it against
 * src/content/types.ts and falls back to known-good defaults if it fails.
 *
 * Limits (enforced): headline ≤ 70 characters, subhead ≤ 180, CTA labels
 * ≤ 24, at most 4 trust items of ≤ 40 each, at most 5 featured instructors,
 * chosen by id from src/content/instructors.ts.
 */
export const homeHero: HomeHeroContent = {
  // Owner decision 5: Concept B is the default. "editorial" (A) and
  // "spacious" (C) are the alternatives.
  layout: "teachers",
  eyebrow: "Online Quran education · Serving families in the US & Canada",
  // Spec §7.1's headline is 86 characters; the owner chose this 66-character
  // version on 19 Nov 2026. "Live" and "one-on-one" are in the subhead.
  headline: "Learn the Qur’an from home with qualified Huffaz, Ulama and Mufti.",
  highlight: "qualified Huffaz, Ulama and Mufti",
  // PRODUCT.md decision 4: say the first month is free; never claim no card is needed.
  subhead:
    "Classes are live, one-on-one or in a small batch, with female tutors for girls and young children, and your first month is free.",
  primaryCta: { label: "Start free trial", href: "/enroll" },
  secondaryCta: { label: "Browse courses", href: "/courses" },
  // PRODUCT.md "Evidence on Hand": approximate figures confirmed by the owner.
  trust: ["250+ students taught", "25+ qualified instructors", "501(c)(3) nonprofit", "Nearly half of our students study free"],
  // Used by the "editorial" and "spacious" layouts only. There is no real
  // class photograph yet (spec §8), so this is the dev placeholder: replace it
  // before switching the live hero to either of those layouts.
  image: {
    src: "/dev/arch-sample.svg",
    alt: "Placeholder for a photograph of a live class",
    width: 800,
    height: 800,
    focalPoint: { x: 50, y: 40 },
  },
  featuredInstructorIds: [
    "mufti-ariful-islam",
    "mufti-shaker-waliullah",
    "mufti-muhammad-faijullah",
    "mufti-ahmed-mostafa-raian",
    "hafez-nurul-ahsan",
  ],
};
