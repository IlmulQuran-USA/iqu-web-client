import { draft, draftList, live, liveList, pending, pendingList } from "./copy";
import { renamedInstructorSlugs, liveInstructorPaths } from "./legacy-paths";
import { instructorSchema, type Instructor } from "./types";

/*
 * All 20 instructors, from docs/spec/COURSE-CONTENT.md §10 (the live
 * database, read 20 Nov 2026), in its order: leadership, then brothers, then
 * sisters. The Home hero picks five by id in its own order
 * (src/content/home-hero.ts), so the order here does not affect it.
 * Profiles live at /instructors/<id>.
 *
 * Names are written exactly as §10 gives them. `role` is the card caption
 * (≤ 24 characters, enforced by the schema) and never repeats the title
 * already in the name. Every text carries a status (see ./copy):
 *   - bios are the live profile, set as full sentences that begin with the
 *     teacher's name; nothing is added;
 *   - qualifications are pending where §10 gives none, or where the live
 *     field held placeholder text (§11);
 *   - roleFull is live for the five the owner supplied on 19 Nov 2026 and
 *     pending for the others.
 * Never carried over (§11): ratings, review counts, student counts,
 * testimonials, placeholder qualifications.
 *
 * Portraits, hero five: the owner's own final files (20 Nov 2026), used exactly as
 * supplied: no crop, scale, background change or re-encode. All five share one
 * framing (eyes at 35% of the height, same face size, centred, on --surface
 * #F1F5F9), so every card shows them the same way (object-fit: cover,
 * object-position: 50% 50%). Four are 600 × 600; Hafez Nurul Ahsan's is the
 * earlier 370 × 370 file, kept by the owner. Replace a file at the same path
 * and update its size here.
 * Everyone else has `photo: null` and keeps the arch monogram (spec §7.1).
 * Mufti Mushfiqur Rahman, Mufti Shamsuddin Rois, Mufti Sajidullah and Mufti
 * Jubayer bin Jalaluddin: their live-site portraits were removed (owner,
 * 21 Nov 2026) until the owner supplies new ones; the live-site originals
 * stay in design/brand-source/instructors-original/. Mufti Muaj Al-Juhany
 * has no live portrait, and the live images for the sisters are shared
 * placeholders and are never used. A photo that is usable but needs better
 * framing can carry `reframe: true`; `npm run content:check` lists it.
 */
/** A square portrait at its native pixel size. */
const portrait = (id: string, size: 600 | 370 = 600) => ({ src: `/instructors/${id}.webp`, width: size, height: size });

export const instructors: Instructor[] = instructorSchema.array().parse([
  /* ── Leadership ───────────────────────────────────────────────────────── */
  {
    id: "mufti-muhammad-faijullah",
    name: "Mufti Muhammad Faijullah",
    gender: "male",
    role: "Director",
    roleFull: live("Director, Ilm-Ul-Quran USA"),
    languages: ["Bengali", "English", "Arabic", "Urdu"],
    bio: live(
      "Mufti Muhammad Faijullah is the Director of Ilm-Ul-Quran USA, guiding the institution with a strong commitment to Quranic and Islamic education. A well-qualified ‘Alim and Mufti, he combines Islamic scholarship with administrative expertise, and shapes programs that are spiritually enriching and academically sound.",
    ),
    qualifications: liveList([
      "Dawrah-e-Hadith (Masters in Hadith Studies), Darul Uloom Muinul Islam, Hathazari, Chattogram, Bangladesh",
      "Takhassus fil Fiqh wal Ifta",
      "Strong foundation in Arabic, Tafsir, Aqeedah, Fiqh and Islamic history",
      "Experience in online Islamic education management, outreach and curriculum development",
      "Da‘wah in Bangladesh and Islamic educational programs across the USA",
    ]),
    photo: portrait("mufti-muhammad-faijullah"),
  },
  {
    id: "mufti-ahmed-mostafa-raian",
    name: "Mufti Ahmed Mostafa Raian",
    gender: "male",
    role: "Education Secretary",
    roleFull: live("Quran Teacher & Education Secretary"),
    languages: ["Bengali", "Arabic", "Urdu"],
    bio: live(
      "Mufti Ahmed Mostafa Raian is a Hafiz and ‘Alim serving as Quran instructor and Education Secretary at Ilm-Ul-Quran USA. He is also an Imam and Khateeb, with deep expertise in Quranic memorization, Tajweed and the classical Islamic sciences.",
    ),
    // §10: the live field holds course copy and lorem ipsum (§11). This list
    // is taken from his live bio: CONTENT-ADDENDUM.md §4 (draft).
    qualifications: draftList([
      "Hafiz of the Quran",
      "‘Alim",
      "Imam and Khateeb",
      "Quran instructor and Education Secretary at Ilm-Ul-Quran USA",
    ]),
    photo: portrait("mufti-ahmed-mostafa-raian"),
  },
  {
    id: "hafez-nurul-ahsan",
    name: "Hafez Muhammad Nurul Ahsan",
    gender: "male",
    role: "Hifz & Recitation",
    roleFull: live("Quran Reading, Recitation & Hifz · Program Coordinator"),
    languages: ["Bengali", "Urdu"],
    bio: live(
      "Hafez Muhammad Nurul Ahsan is a qualified Hafez of the Quran who teaches Quran reading, Tajweed and Hifz to children and beginners with a patient, encouraging style. He also leads Ilm-Ul-Quran USA’s technical and day-to-day operations, and coordinates the Summer and Weekend programs.",
    ),
    qualifications: liveList([
      "Hifz-ul-Quran from a reputed Qawmi madrasah",
      "Well-versed in Tajweed",
      "Experienced in teaching memorization and reading to children and beginners",
    ]),
    photo: portrait("hafez-nurul-ahsan", 370),
  },

  /* ── Scholars and teachers (brothers) ─────────────────────────────────── */
  {
    id: "mufti-ariful-islam",
    name: "Mufti Ariful Islam",
    gender: "male",
    role: "Senior Instructor",
    roleFull: live("Senior Instructor & Islamic Scholar"),
    languages: ["Bengali", "English", "Arabic", "Urdu"],
    bio: live(
      "Mufti Ariful Islam is a well-qualified ‘Alim and Mufti with deep expertise in Islamic jurisprudence and advanced Islamic studies. He teaches from basic Quran reading to advanced Fiqh, Tafsir, Hadith and Aqeedah, tailored to each student’s level. Currently based in South Korea, he is active in da‘wah and Islamic education.",
    ),
    qualifications: liveList([
      "‘Alim with Takmil (Dawrah-e-Hadith)",
      "Specialization in Ifta",
      "Well-versed in Fiqh, Aqa’id, Hadith and Tafsir",
      "Leads topic-based courses",
    ]),
    photo: portrait("mufti-ariful-islam"),
  },
  {
    id: "mufti-shaker-waliullah",
    name: "Mufti Shaker Waliullah",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: live("Quran & Islamic Education Teacher"),
    languages: ["Bengali", "Arabic", "Urdu"],
    // §10: the live fields hold course copy and lorem ipsum (§11). Bio:
    // CONTENT-ADDENDUM.md §4 (draft). Qualifications stay pending: never
    // invent credentials for a real person.
    bio: draft(
      "Mufti Shaker Waliullah teaches Quran and Islamic education at Ilm-Ul-Quran USA, in Bengali, Arabic and Urdu.",
    ),
    qualifications: pendingList,
    photo: portrait("mufti-shaker-waliullah"),
  },
  {
    id: "mufti-muaj-al-juhany",
    name: "Mufti Muaj Al-Juhany",
    gender: "male",
    role: "Quranic Arabic",
    roleFull: pending,
    languages: ["Bengali", "Arabic", "Urdu"],
    bio: live(
      "Mufti Muaj Al-Juhany is a Hafez and ‘Alim with an academic background in Arabic literature and ‘Uloom al-Hadith. He serves primarily as an Arabic language instructor for students of all levels.",
    ),
    qualifications: liveList([
      "Hifz al-Quran",
      "Alimiyyah",
      "M.A. in Arabic Literature, Darul Uloom Deoband, India",
      "Takhassus in ‘Uloom al-Hadith",
      "Diploma in Arabic Language and Literature",
      "Da‘wah and Comparative Religion course",
      "Arabic instructor for native and non-native speakers",
    ]),
    photo: null,
  },
  {
    id: "mufti-mushfiqur-rahman",
    name: "Mufti Mushfiqur Rahman",
    gender: "male",
    role: "Advanced Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Urdu", "Arabic"],
    bio: live(
      "Mufti Mushfiqur Rahman is a highly qualified ‘Alim and Mufti with years of teaching experience. He teaches Quran reading, recitation and memorization, and advanced Islamic studies, based on the Quran and authentic Sunnah.",
    ),
    qualifications: liveList([
      "Dars-e-Nizami (Alim course)",
      "Specialization in Ifta",
      "Certified Mufti, serving at a fatwa center in Bangladesh",
      "Proficient in Quranic Arabic, Tafsir, Fiqh, Aqeedah and Hadith",
    ]),
    photo: null, // Removed 21 Nov 2026; the owner will supply a new portrait.
  },
  {
    id: "mufti-shamsuddin-rois",
    name: "Mufti Shamsuddin Rois",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Urdu", "Arabic"],
    bio: live(
      "Mufti Shamsuddin Rois is a Hafez, ‘Alim and Mufti who teaches Quran reading, recitation and memorization, and advanced subjects such as Fiqh and Aqeedah, rooted in traditional scholarship.",
    ),
    qualifications: liveList([
      "Takmil (Master’s in Islamic Studies), Qawmi madrasah, Bangladesh",
      "Specialization in Ifta",
      "Full Hifz with Tajweed",
      "Teaches Quran, Fiqh and Aqeedah online and in person",
    ]),
    photo: null, // Removed 21 Nov 2026; the owner will supply a new portrait.
  },
  {
    id: "mufti-sajidullah",
    name: "Mufti Sajidullah",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Arabic", "English", "Urdu"],
    bio: live(
      "Mufti Sajidullah is a Hafez and ‘Alim with a strong background in Quranic sciences and Islamic jurisprudence. He teaches Quran reading, recitation, translation and memorization, and Islamic studies from basic to advanced.",
    ),
    qualifications: liveList([
      "Dawrah-e-Hadith",
      "Takhassus fil Fiqh wal Ifta",
      "Hafiz with Tajweed and Tarteel",
      "Fluent in Quranic Arabic, translation and tafsir",
    ]),
    photo: null, // Removed 21 Nov 2026; the owner will supply a new portrait.
  },
  {
    id: "mufti-jubayer-bin-jalaluddin",
    name: "Mufti Jubayer bin Jalaluddin",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Arabic"],
    bio: live(
      "Mufti Jubayer bin Jalaluddin is a Hafez and Mufti who teaches Quran reading, recitation with Tajweed, memorization and translation, with a calm, supportive style.",
    ),
    qualifications: liveList([
      "Hifz with distinction",
      "Alimiyyah",
      "Ifta course",
      "Strong in Tajweed, recitation and translation",
    ]),
    photo: null, // Removed 21 Nov 2026; the owner will supply a new portrait.
  },
  {
    id: "mawlana-mouinul-islam",
    name: "Mawlana Mouinul Islam",
    gender: "male",
    role: "Quran & Arabic",
    roleFull: pending,
    languages: ["Bengali", "Arabic", "Urdu"],
    bio: live(
      "Mawlana Mouinul Islam is an experienced Quran and Arabic language teacher with an academic background in Islamic studies and Arabic linguistics.",
    ),
    qualifications: liveList([
      "Takmil (Master’s equivalent) in Islamic Studies, Jamia Rahmania Arabia, Dhaka",
      "Diploma in Arabic Language, Nadwatul Ulama, Lucknow, India",
      "Certified in Tajweed and Qira’ah, Madinah Mosque, Dhaka",
    ]),
    photo: null,
  },
  {
    id: "mawlana-nazrul-islam",
    name: "Mawlana Nazrul Islam",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "English", "Arabic"],
    bio: live(
      "Mawlana Nazrul Islam is a qualified ‘Alim who teaches Quran reading, recitation with Tajweed, memorization techniques and fundamental Islamic principles to students of all ages.",
    ),
    qualifications: liveList([
      "Certified ‘Alim",
      "Teaches Quranic Arabic and Quran translation",
      "Fluent in Bengali, proficient in English",
    ]),
    photo: null,
  },
  {
    // Owner, 22 Nov 2026: written with no title (as for Najiba Mahzabin Jeba and Maha Rashed).
    id: "alauddin-khilzi",
    name: "Alauddin Khilzi",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "English", "Arabic", "Urdu"],
    bio: live(
      "Alauddin Khilzi is a Hafez and ‘Alim who teaches Quran reading, recitation, memorization, translation and foundational Islamic education.",
    ),
    qualifications: liveList([
      "Hafez with Tajweed",
      "Dawrah-e-Hadith in Bangladesh, and again at Darul Uloom Deoband, India",
      "Experienced in English-medium settings",
    ]),
    photo: null,
  },
  {
    id: "jawadul-islam-khan-jami",
    name: "Jawadul Islam Khan Jami",
    gender: "male",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Arabic"],
    bio: live(
      "Jawadul Islam Khan Jami is a Hafez and qualified ‘Alim who teaches Quran reading, recitation, memorization and translation, and foundational Islamic studies.",
    ),
    qualifications: liveList([
      "Full Hifz with Tajweed",
      "Dars-e-Nizami (Aalimiyyah)",
      "Training in Quranic recitation and translation",
    ]),
    photo: null,
  },

  /* ── Teachers (sisters): monogram, never a portrait ───────────────────── */
  {
    id: "najiba-mahzabin-jeba",
    name: "Najiba Mahzabin Jeba",
    gender: "female",
    role: "Senior Teacher",
    roleFull: pending,
    languages: ["Bengali", "Arabic", "Urdu"],
    bio: live(
      "Najiba Mahzabin Jeba is a Hafizah and ‘Alimah who teaches Quran reading with Tajweed, recitation, memorization and translation, and foundational Islamic education, to students of all ages.",
    ),
    qualifications: liveList(["Hafizah", "‘Alimah", "Translation and basic Tafsir", "Fiqh, Aqeedah and Islamic manners"]),
    photo: null,
  },
  {
    id: "maha-rashed",
    name: "Maha Rashed",
    gender: "female",
    role: "Hifz & Recitation",
    roleFull: pending,
    languages: ["Bengali", "English", "Urdu"],
    bio: live(
      "Maha Rashed is a Hafizah who teaches Quran reading with Tajweed, recitation and memorization, and foundational Islamic education, with a calm, encouraging style.",
    ),
    qualifications: pendingList,
    photo: null,
  },
  {
    id: "hafezah-nuha-rashed",
    name: "Hafezah Nuha Rashed",
    gender: "female",
    role: "Hifz & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "English", "Arabic", "Urdu"],
    bio: live(
      "Hafezah Nuha Rashed is a Quran teacher with strong expertise in memorization and recitation. She teaches Quran reading, memorization and basic Islamic education with a gentle, clear approach.",
    ),
    qualifications: pendingList,
    photo: null,
  },
  {
    id: "hafezah-humayra-afrin",
    name: "Hafezah Humayra Afrin",
    gender: "female",
    role: "Reading & Memorization",
    roleFull: pending,
    languages: ["Bengali", "English"],
    bio: live(
      "Hafezah Humayra Afrin is a Hafizah skilled in Quran reading, recitation with Tajweed and memorization, who also teaches foundational Islamic education.",
    ),
    qualifications: pendingList,
    noindex: true,
    photo: null,
  },
  {
    id: "shifa-jalal",
    name: "Shifa Jalal",
    gender: "female",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Arabic"],
    // Owner, 22 Nov 2026: keep the field until this is resolved.
    dataNote: {
      status: "draft",
      text: "The languages field says Bengali and Arabic; her live bio says she teaches in English and Bengali. Confirm which is right.",
    },
    bio: live(
      "Shifa Jalal is a Quran teacher focused on a solid foundation in reading and recitation, who teaches basic Islamic education to children and beginners with a calm, caring style.",
    ),
    qualifications: pendingList,
    photo: null,
  },
  {
    id: "afra-humayra",
    name: "Afra Humayra",
    gender: "female",
    role: "Quran & Islamic Studies",
    roleFull: pending,
    languages: ["Bengali", "Urdu"],
    bio: live(
      "Afra Humayra is a Quran teacher who specializes in reading with proper pronunciation, recitation and basic Islamic education, with a compassionate approach to young learners.",
    ),
    qualifications: liveList([
      "Quranic studies with a focus on Tajweed and recitation",
      "Trained in teaching children and beginners",
      "Several years of experience",
    ]),
    photo: null,
  },
]);

export const instructorIds = instructors.map((i) => i.id);

// Every redirect target in ./legacy-paths is a teacher here (that file stays free of content imports).
// The live map covers all 20 profiles exactly once, so no teacher's old URL falls to the catch-all.
if (new Set(Object.values(liveInstructorPaths)).size !== instructors.length) {
  throw new Error("legacy-paths.ts: liveInstructorPaths must map every instructor exactly once");
}
for (const to of [...Object.values(liveInstructorPaths), ...Object.values(renamedInstructorSlugs)]) {
  if (!instructorIds.includes(to)) throw new Error(`legacy-paths.ts redirects to unknown instructor "${to}"`);
}

export function instructorById(id: string): Instructor | undefined {
  return instructors.find((i) => i.id === id);
}
