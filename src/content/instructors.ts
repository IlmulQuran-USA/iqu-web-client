import { instructorSchema, type Instructor } from "./types";

/*
 * The instructor list. Names, roles and their order in the home hero are as
 * the owner supplied them (19 Nov 2026). Slugs are made from the full name;
 * the old site's instructor URLs are not reused. Profiles live at
 * /instructors/<id>.
 *
 * `role` is the card caption (≤ 24 characters, enforced by the schema) and
 * never repeats the title already in the name; `roleFull` is the wording for
 * the profile page. Qur’an is written with the typographic apostrophe.
 *
 * Portraits: the owner's cut-outs (design/brand-source/<name>.png, 370 × 406),
 * confirmed file by file by the owner, with the pastel card keyed out to
 * --surface and cropped square at native size by
 * scripts/instructor-portraits.mjs. The 600 × 600 minimum is waived by the
 * owner until larger originals exist (19 Nov 2026); replace the file at the
 * same path and update width/height when they do. A re-crop to a common face
 * scale waits for a looser original of Mufti Shaker Waliullah.
 * An instructor with `photo: null` keeps the arch monogram (spec §7.1).
 */
const portrait = (id: string) => ({ src: `/instructors/${id}.webp`, width: 370, height: 370 });

export const instructors: Instructor[] = instructorSchema.array().parse([
  {
    id: "mufti-ariful-islam",
    name: "Mufti Ariful Islam",
    role: "Senior Instructor",
    roleFull: "Senior Instructor & Islamic Scholar",
    photo: portrait("mufti-ariful-islam"),
  },
  {
    id: "mufti-shaker-waliullah",
    name: "Mufti Shaker Waliullah",
    role: "Qur’an & Islamic Studies",
    roleFull: "Qur’an & Islamic Education Teacher",
    photo: portrait("mufti-shaker-waliullah"),
  },
  {
    id: "mufti-muhammad-faijullah",
    name: "Mufti Muhammad Faijullah",
    role: "Director",
    roleFull: "Director, Ilm-Ul-Quran USA",
    photo: portrait("mufti-muhammad-faijullah"),
  },
  {
    id: "mufti-ahmed-mostafa-raian",
    name: "Mufti Ahmed Mostafa Raian",
    role: "Education Secretary",
    roleFull: "Qur’an Teacher & Education Secretary",
    photo: portrait("mufti-ahmed-mostafa-raian"),
  },
  {
    id: "hafez-nurul-ahsan",
    name: "Hafez Nurul Ahsan",
    role: "Hifz & Recitation",
    roleFull: "Qur’an Reading, Recitation & Hifz · Program Coordinator",
    photo: portrait("hafez-nurul-ahsan"),
  },
]);

export const instructorIds = instructors.map((i) => i.id);

export function instructorById(id: string): Instructor | undefined {
  return instructors.find((i) => i.id === id);
}
