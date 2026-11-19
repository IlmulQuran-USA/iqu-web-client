import { z } from "zod";
import { homeHero as source } from "@/content/home-hero";
import { instructorById, instructorIds } from "@/content/instructors";
import { homeHeroSchema, type HomeHero, type HomeHeroContent, type Instructor } from "@/content/types";

/*
 * The one way to read the Home hero. Pages call only this, so the source can
 * move from src/content/home-hero.ts to the admin settings store
 * (/a/settings/home, PRODUCT.md owner decision 5) without touching a
 * component. It is async for that reason.
 *
 * If the content fails validation, the error is logged and the known-good
 * defaults below are served instead, so a bad edit can never break the page.
 */

/** Known-good copy of the hero as approved on 19 Nov 2026. Edit src/content/home-hero.ts, not this. */
const DEFAULTS: HomeHeroContent = {
  layout: "teachers",
  eyebrow: "Online Quran education · Serving families in the US & Canada",
  headline: "Learn the Qur’an from home with qualified Huffaz, Ulama and Mufti.",
  highlight: "qualified Huffaz, Ulama and Mufti",
  subhead:
    "Classes are live, one-on-one or in a small batch, with female tutors for girls and young children, and your first month is free.",
  primaryCta: { label: "Start free trial", href: "/enroll" },
  secondaryCta: { label: "Browse courses", href: "/courses" },
  trust: ["250+ students taught", "25+ qualified instructors", "501(c)(3) nonprofit", "Nearly half of our students study free"],
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

/* Placeholder LQIP for the dev class image; a real photograph supplies its own. */
const PLACEHOLDER_BLUR =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1e293b"/><rect y="5.4" width="10" height="4.6" fill="#334155"/><rect y="7" width="10" height="3" fill="#0f172a"/><circle cx="7" cy="3.1" r="1.5" fill="#f96c48"/></svg>',
  ).toString("base64");

export async function getHomeHero(): Promise<HomeHero> {
  const schema = homeHeroSchema(instructorIds);
  const parsed = schema.safeParse(source);

  let content: HomeHeroContent;
  if (parsed.success) {
    content = parsed.data;
  } else {
    console.error(`[getHomeHero] Home hero content is invalid; serving the defaults.\n${z.prettifyError(parsed.error)}`);
    // Defaults survive an instructor being removed from the list.
    content = schema.parse({
      ...DEFAULTS,
      featuredInstructorIds: DEFAULTS.featuredInstructorIds.filter((id) => instructorIds.includes(id)),
    });
  }

  const image =
    content.image.src === DEFAULTS.image.src && !content.image.blurDataURL
      ? { ...content.image, blurDataURL: PLACEHOLDER_BLUR }
      : content.image;

  return {
    ...content,
    image,
    featuredInstructors: content.featuredInstructorIds
      .map(instructorById)
      .filter((i): i is Instructor => i !== undefined),
  };
}
