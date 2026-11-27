import { programs } from "./pricing.ts";

/*
 * Search titles that keep what the live site ranked on (SEO parity for the
 * domain switch, owner 27 Nov 2026; live titles read 27 Nov 2026, see
 * F:/iqu-setup/reports/seo-parity.md). Only where the new page title alone
 * dropped the live search phrase; every other page keeps its own title.
 * pageMetadata() (src/lib/metadata.ts) applies these by path, so the page's
 * visible heading never changes. Facts only: each phrase is the live title's
 * wording or a settled fact (PRODUCT.md, pricing.ts). Sentence case, as on
 * the rest of the site; the template adds " · Ilm-Ul-Quran USA".
 */

export const searchTitles: Record<string, string | { absolute: string }> = {
  // Live: "Meet Our Quran Instructors"
  "/instructors": "Meet our Quran teachers",
  // Live: "About Ilm-Ul-Quran USA | 501(c)(3) Quran Education Nonprofit"
  "/about": { absolute: "About Ilm-Ul-Quran USA · 501(c)(3) Quran nonprofit" },
  // Live: "Donate to Ilm-Ul-Quran USA | Support Free Quran Education"
  "/donate": "Donate to support Quran education",
  // Live: "Contact Ilm-Ul-Quran USA | Richardson, Texas"
  "/contact": { absolute: "Contact Ilm-Ul-Quran USA · Richardson, Texas" },
  // Live: "Enroll Free | First Month Free Quran Classes"
  "/enroll": "Enroll in online Quran classes",
  // Live: "Online Quran Memorization (Hifz) Course"
  "/courses/quran-hifz": "Quran Hifz (memorization) course online",
  // Live: "Quran Nazirah - Online Recitation Classes"
  "/courses/quran-nazirah": "Quran Nazirah: online recitation classes",
  // Live: "Noorani Qaidah Online Course for Kids"
  "/courses/noorani-qaidah": "Noorani Qaidah online course",
  // Live: "Free Weekend Ilm Program for Kids" (free for every family, ages 5–12: pricing.ts)
  [programs.weekend.href]: `Free ${programs.weekend.label}, ages ${programs.weekend.ages}`,
  // Live: "Summer Ilm Camp Online 2026 | Ages 5-15" (ages from pricing.ts; no year, so it never goes stale)
  [programs.summer.href]: `${programs.summer.label} online, ages ${programs.summer.ages}`,
};
