import { instructorSchema, type Instructor } from "./types";

/*
 * The instructor list. Names and titles are as the owner supplied them
 * (19 Nov 2026). Slugs are made from the full name; the old site's
 * instructor URLs are not reused.
 *
 * Portraits: the owner's cut-outs (design/brand-source/<name>.png, 370 × 406),
 * confirmed file by file by the owner, with the pastel card keyed out to
 * --surface and cropped square at native size by
 * scripts/instructor-portraits.mjs. The 600 × 600 minimum is waived by the
 * owner until larger originals exist (19 Nov 2026); replace the file at the
 * same path and update width/height when they do.
 * An instructor with `photo: null` keeps the arch monogram (spec §7.1).
 */
const portrait = (id: string) => ({ src: `/instructors/${id}.webp`, width: 370, height: 370 });

export const instructors: Instructor[] = instructorSchema.array().parse([
  { id: "mufti-ariful-islam", name: "Mufti Ariful Islam", title: "Mufti", photo: portrait("mufti-ariful-islam") },
  {
    id: "mufti-shaker-waliullah",
    name: "Mufti Shaker Waliullah",
    title: "Mufti",
    photo: portrait("mufti-shaker-waliullah"),
  },
  {
    id: "mufti-muhammad-faijullah",
    name: "Mufti Muhammad Faijullah",
    title: "Mufti · Director",
    photo: portrait("mufti-muhammad-faijullah"),
  },
  {
    id: "mufti-ahmed-mostafa-raian",
    name: "Mufti Ahmed Mostafa Raian",
    title: "Mufti",
    photo: portrait("mufti-ahmed-mostafa-raian"),
  },
  { id: "hafez-nurul-ahsan", name: "Hafez Nurul Ahsan", title: "Hafez", photo: portrait("hafez-nurul-ahsan") },
]);

export const instructorIds = instructors.map((i) => i.id);

export function instructorById(id: string): Instructor | undefined {
  return instructors.find((i) => i.id === id);
}
