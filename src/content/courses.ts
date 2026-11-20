import { draft, draftList, live, liveList, pending } from "./copy";
import { instructorIds } from "./instructors";
import { monthlyCourses, programs, type CourseId, type MonthlyCourse, type ProgramId } from "./pricing";
import { courseContentSchema, type CourseContent } from "./types";

/*
 * Course and program copy, from docs/spec/COURSE-CONTENT.md §1–§9 (owner,
 * 20 Nov 2026). Names, slugs and prices are not here: they come from
 * ./pricing, matched by id, and this file fails to load if the two lists
 * drift apart.
 *
 * Status (see ./copy): text marked "(live)" or given by the owner is live;
 * text marked "(draft — confirm)" is draft; anything not supplied is pending
 * and stays empty. Never carried over (COURSE-CONTENT.md §11): ratings,
 * review and student counts, testimonials, "99% student satisfaction",
 * "Free lifetime support", "Retake: yes", "What's included in this
 * challenge?", "Duration 2 weeks / 10 lessons", the Qaidah curriculum on
 * other courses, and the old Home lines on fees and devices.
 *
 * Dates follow CLAUDE.md §4 (30 Aug 2026) and every time carries its zone.
 */

/* ── §1 · Rules for every course (live, confirmed by the owner) ──────────── */

export const courseRules = {
  format: live("All classes are online, live on Zoom. Students choose one-on-one or batch (small group)."),
  teacherAssignment: live("Male teachers for brothers; female teachers for sisters and young children."),
  certificate: live("A certificate is awarded at the end of every course."),
  languages: live("Classes are taught in English, Bengali, Arabic and Urdu."),
  learningPath: live(
    "Noorani Qaidah, then Qur’an Nazirah (reading the Qur’an), then Qur’an Hifz. Nazirah is the reading stage that comes before Hifz.",
  ),
} as const;

/* ── §3–§8 · Courses ─────────────────────────────────────────────────────── */

const courseCopy: Record<CourseId, CourseContent> = {
  "noorani-qaidah": {
    id: "noorani-qaidah",
    livePath: "/course/nurani-qaida-for-kids/",
    meta: live(
      "The perfect starting point for beginners. Learn Arabic letters, pronunciation and Tajweed basics before reading the Qur’an.",
    ),
    overview: live(
      "For beginners who want to learn to read the Qur’an with proper pronunciation and Tajweed. It builds a strong foundation in recognizing Arabic letters, joining words and articulating each sound correctly.",
    ),
    audience: live("Children and adults starting from the beginning."),
    highlights: liveList([
      "Step by step, from single letters to complete words",
      "Correct pronunciation and Tajweed rules",
      "Interactive, engaging teaching methods",
      "Qualified male and female teachers",
      "One-on-one or batch, on a flexible schedule",
      "Suitable for children and adults",
    ]),
    // The 48-class plan (live).
    curriculum: {
      kind: "classPlan",
      status: "live",
      rows: [
        {
          classes: "1–9",
          focus: "Arabic alphabet: letters and their Makhraj, taught through TPI (Total Physical Interaction) rather than rote methods",
          checkpoint: "Revision and exam in class 10",
        },
        { classes: "11–19", focus: "Harakat: Zabar, Zer, Pesh and the other symbols", checkpoint: "Revision and exam in class 20" },
        {
          classes: "21–29",
          focus: "Madd letters and recitation rules such as Tanween, Izhar and Ikhfa",
          checkpoint: "Revision and exam in class 30",
        },
        {
          classes: "31–39",
          focus: "Ghunnah, the pronunciation of “Ra” and other advanced rules",
          checkpoint: "Revision and exam in class 40",
        },
        {
          classes: "41–47",
          focus: "Idgham, the rules of stopping, Huroof Muqatta’at and more",
          checkpoint: "Revision and exam in class 48",
        },
      ],
    },
    support: live(
      "Direct contact with the teacher, Q&A sessions, WhatsApp messaging, supplementary readings, PDFs and homework.",
    ),
    certificate: { status: "live", value: true },
    nextStepId: "quran-nazirah",
    teachers: { status: "live", ids: ["mufti-shaker-waliullah"] },
  },

  "quran-nazirah": {
    id: "quran-nazirah",
    livePath: "/course/quran-nazirah/",
    meta: live(
      "Learn to recite the Qur’an fluently with correct Tajweed. Online Nazirah classes for brothers and sisters of all ages.",
    ),
    overview: live(
      "Online Qur’an Nazirah (recitation) classes for brothers and sisters of all ages. Students develop fluency in reading the Qur’an with proper Tajweed, guided by qualified male and female teachers.",
    ),
    placement: live("Nazirah is reading the Qur’an itself, after the Qaidah and before Hifz."),
    audience: live("Students who have completed the Noorani Qaidah or can already read Arabic letters with harakat."),
    highlights: liveList([
      "Fluent reading of the Qur’an with correct Tajweed",
      "Tajweed rules: proper articulation and pronunciation",
      "One-on-one or group classes, on your schedule",
      "Male teachers for brothers; female teachers for sisters and young children",
      "Learn from home, at a time that suits you",
    ]),
    method: {
      kind: "steps",
      status: "draft",
      steps: [
        {
          title: "Bridging from the Qaidah",
          text: "Reading short surahs of Juz ‘Amma from the mushaf, applying the rules learned in the Qaidah.",
        },
        {
          title: "Reading through the Qur’an",
          text: "The student reads aloud to the teacher, portion by portion, juz by juz. The teacher listens, corrects pronunciation and Tajweed on the spot, and sets the next portion.",
        },
        {
          title: "Fluency and completion",
          text: "Steady pace, correct stops (waqf) and Tajweed applied without prompting, working toward a complete reading (khatm) of the Qur’an.",
        },
        { title: "Revision", text: "Earlier portions are re-read regularly so fluency holds." },
      ],
    },
    certificate: { status: "live", value: true },
    nextStepId: "quran-hifz",
    teachers: {
      status: "live",
      ids: [
        "hafezah-nuha-rashed",
        "shifa-jalal",
        "afra-humayra",
        "jawadul-islam-khan-jami",
        "ustadha-maha-rashed",
        "ustadha-najiba-mahzabin-jeba",
        "mufti-ahmed-mostafa-raian",
        "mufti-shaker-waliullah",
        "mufti-mushfiqur-rahman",
        "mufti-shamsuddin-rois",
      ],
    },
  },

  "quran-hifz": {
    id: "quran-hifz",
    livePath: "/course/quran-memorization/",
    meta: live(
      "Memorize the Holy Qur’an with proper Tajweed and fluency. Structured online Hifz classes with qualified Huffaz for children and adults.",
    ),
    overview: live(
      "For students who wish to memorize the Holy Qur’an with proper Tajweed and fluency. A structured approach lets each student memorize at their own pace under the supervision of qualified teachers. One-on-one and batch classes are available.",
    ),
    audience: live("Students who can read the Qur’an fluently (Nazirah level)."),
    highlights: liveList([
      "100% online, with flexible scheduling",
      "A personal memorization plan based on each student’s capability",
      "Emphasis on Tajweed and correct pronunciation",
      "Daily revision and retention techniques",
      "Experienced male and female teachers",
      "One-on-one and batch options",
      "Suitable for children and adults",
    ]),
    // Every class has three parts (PRODUCT.md method).
    method: {
      kind: "steps",
      status: "live",
      steps: [
        { title: "Sabaq", text: "The new lesson. A set number of lines, memorized and recited to the teacher." },
        { title: "Sabqi", text: "Revision of the recent lessons, so new memorization settles." },
        { title: "Manzil", text: "Revision of older portions, so nothing memorized is lost." },
      ],
    },
    path: draftList([
      "The student usually starts with Juz ‘Amma, then moves through the Qur’an juz by juz.",
      "The daily amount grows with the student’s ability.",
      "Teachers set homework revision between classes.",
    ]),
    certificate: { status: "live", value: true },
    teachers: { status: "live", ids: ["mawlana-mouinul-islam", "mawlana-nazrul-islam"] },
  },

  "quranic-arabic-level-1": {
    id: "quranic-arabic-level-1",
    livePath: "/course/quranic-arabic-mastery-level-1/",
    meta: live(
      "Understand up to 80% of the Qur’an by listening and reading. Grammar, vocabulary and practice in one structured online program.",
    ),
    overview: live(
      "Master the fundamentals of Quranic Arabic. The program combines grammar, vocabulary and practical Qur’anic application to build a deep, lasting connection with the Book of Allah, in sha’ Allah.",
    ),
    // Present as the course's aim, never as a guarantee (COURSE-CONTENT.md §6).
    objective: live(
      "To understand at least 80% of Qur’anic verses through listening and reading within one year, in sha’ Allah.",
    ),
    audience: live("Students who can read the Qur’an fluently with harakat and sukun. No prior Arabic grammar is needed."),
    // Owner, 20 Nov 2026. The fee is the 4-day fee in ./pricing.
    schedule: liveList(["Four days a week, for one year."]),
    highlights: liveList([
      "Practical, Qur’an-focused learning",
      "Guided grammar and vocabulary",
      "Weekly translation and comprehension practice",
      "A final tafsir and grammar project",
    ]),
    curriculum: {
      kind: "phases",
      status: "live",
      phases: [
        {
          title: "Foundations",
          months: "Months 1–3",
          goal: "Core grammar and vocabulary for basic Qur’anic structures.",
          topics: [
            "The alphabet (refresher)",
            "Ism, fi‘l and harf",
            "Definite and indefinite (al, tanween)",
            "Personal and attached pronouns",
            "Gender and number",
            "Present and past tense",
            "Jumlah ismiyyah and fi‘liyyah",
            "Mubtada’–khabar",
            "Root-based vocabulary",
          ],
          practice: "Short Qur’anic phrases, Juz ‘Amma vocabulary, simple translation and tafsir exercises.",
        },
        {
          title: "Grammar expansion",
          months: "Months 4–6",
          goal: "Mid-level sentence structures and essential grammar.",
          topics: [
            "Detailed pronoun use",
            "Verb forms I–V",
            "Harf al-jarr",
            "Idafah",
            "Adjectives",
            "Negation (la, lam, lamma, ma, laysa)",
            "Inna",
            "Common Qur’anic particles",
          ],
          practice: "Short ayahs from Juz 30 and 29, 500 common Qur’anic words, root extraction.",
        },
        {
          title: "Advanced grammar and Qur’anic style",
          months: "Months 7–9",
          goal: "Qur’anic expressions and complex grammar.",
          topics: [
            "Verb forms I–X",
            "Conditionals and relative clauses",
            "Kana and its sisters",
            "Inna and its sisters",
            "Qur’anic emphasis",
            "An introduction to balaghah",
          ],
          practice: "Ayah analysis, longer passages, comparative meaning analysis.",
        },
        {
          title: "Full Qur’anic immersion",
          months: "Months 10–12",
          goal: "Direct comprehension and analysis of Qur’anic verses.",
          topics: [
            "Al-Fatihah",
            "Excerpts from Al-Baqarah, Yasin, Al-Mulk and Al-Kahf",
            "Thematic vocabulary",
            "Integrated recitation and understanding",
            "Tafsir-based learning",
            "Listening comprehension",
          ],
          practice: "Weekly translation assignments, oral quizzes, listening tests, student presentations.",
        },
      ],
    },
    assessment: liveList([
      "Monthly quizzes",
      "Mid-course exam at 6 months",
      "Final grammar and tafsir project on a selected surah",
      "Final exam in translation and listening comprehension",
    ]),
    // In sha’ Allah: aims, not guarantees.
    outcomes: liveList([
      "Understand about 80% of the Qur’anic text through listening and reading",
      "Translate and analyze a wide range of Qur’anic passages",
      "A foundation for advanced study",
    ]),
    note: live("Ilm-Ul-Quran USA may adjust the curriculum to better meet students’ needs."),
    certificate: { status: "live", value: true },
    teachers: { status: "live", ids: ["mufti-muaj-al-juhany", "mawlana-nazrul-islam"] },
  },

  "tarjumatul-quran": {
    id: "tarjumatul-quran",
    livePath: null,
    meta: pending,
    // Owner, 20 Nov 2026.
    placement: live("Tarjumatul Qur’an teaches only the meaning of the Qur’an."),
    overview: draft(
      "Understand what you recite. Tarjumatul Qur’an teaches the meaning of the Qur’an, word by word and ayah by ayah, so students follow what they read in salah and in recitation. The course covers meaning only; recitation and memorization are taught in Nazirah and Hifz.",
    ),
    audience: draft("Students who can already read the Qur’an."),
    certificate: { status: "live", value: true },
    // Several teachers list Qur’an translation among their skills; the owner has not assigned any.
    teachers: { status: "pending", ids: [] },
  },

  "islamic-studies": {
    id: "islamic-studies",
    livePath: null,
    // The owner has not supplied these. Until then the page shows only its
    // price, schedule options and the rules in courseRules. Never borrow the
    // Weekend program's curriculum.
    meta: pending,
    overview: pending,
    audience: pending,
    curriculum: { kind: "pending", status: "pending" },
    certificate: { status: "live", value: true },
    teachers: { status: "pending", ids: [] },
  },
};

/* ── §9 · Programs ───────────────────────────────────────────────────────── */

const programCopy: Record<ProgramId, CourseContent> = {
  "weekend-ilm-program": {
    id: "weekend-ilm-program",
    livePath: "/course/weekend-ilm-program/",
    meta: pending,
    overview: live(
      "Essential Islamic knowledge for children aged 5–12, in an engaging and structured way. In live online weekend classes, students learn Qur’an recitation with Tajweed, foundational beliefs (Aqeedah), Islamic manners (Akhlaq), basic Fiqh, and selected duas and surahs for daily life. Taught by qualified, caring teachers, the program helps children build a strong Islamic identity, deepen their connection to Allah and practice Islam confidently, in sha’ Allah.",
    ),
    schedule: liveList([
      "Ages 5–12.",
      "Saturdays and Sundays, 10–11 AM CT (one hour per session).",
      "Live, interactive, with follow-up materials.",
    ]),
    curriculum: {
      kind: "topics",
      status: "live",
      groups: [
        {
          title: "Qur’an and Tajweed",
          items: [
            "Correct pronunciation (Makharij)",
            "Tajweed rules, basic to intermediate",
            "Recitation practice",
            "Memorizing essential surahs (Juz ‘Amma)",
          ],
        },
        {
          title: "Aqeedah",
          items: [
            "The six pillars of Iman",
            "Tawheed",
            "Belief in the angels, the books, the prophets, the Day of Judgment and Qadr",
          ],
        },
        {
          title: "Fiqh",
          items: [
            "Wudu and salah",
            "Daily etiquettes (eating, greeting, dressing)",
            "An introduction to fasting, zakah and Hajj",
          ],
        },
        {
          title: "Akhlaq",
          items: [
            "Respecting parents, teachers and elders",
            "Truthfulness, honesty, patience and gratitude",
            "Good habits",
          ],
        },
        {
          title: "Duas and daily remembrance",
          items: ["Daily duas", "Morning and evening adhkar", "Short supplications from the Sunnah"],
        },
        {
          title: "Islamic history and stories",
          items: ["Stories of the Prophets", "Lessons from the Sahabah", "Moral values through history"],
        },
      ],
    },
    // The live database says "Certification: no"; the owner has not decided (COURSE-CONTENT.md C3).
    certificate: { status: "pending", value: null },
    teachers: { status: "live", ids: ["mufti-ariful-islam", "ustad-alauddin-khilzi", "mawlana-nazrul-islam"] },
  },

  "summer-ilm-camp": {
    id: "summer-ilm-camp",
    // Live name: Summer Islamic Education Program.
    livePath: "/course/summer-islamic-education-program/",
    meta: pending,
    overview: live(
      "An online summer program that keeps children connected to the Qur’an and Islamic learning during their summer break, with qualified teachers in a nurturing environment.",
    ),
    // 2026 dates and schedule (live). Ages and levels: PLUGIN-INVENTORY §1.
    schedule: liveList([
      "1 Jun – 31 Jul 2026.",
      "Five days a week (Saturday, Sunday and Tuesday–Thursday), 10:00 AM–12:00 PM CT.",
      "Evening homework support.",
      "Ages 5–15, in two levels: Level 1 for ages 5–10, Level 2 for ages 11–15.",
    ]),
    curriculum: {
      kind: "topics",
      status: "live",
      groups: [
        {
          title: "Qur’an studies",
          items: ["Recitation with Tajweed", "Memorizing short surahs from Juz ‘Amma", "Selected meanings and lessons"],
        },
        {
          title: "Islamic studies",
          items: [
            "Daily duas with meanings",
            "Adab and Akhlaq",
            "Basic Fiqh (wudu, salah, cleanliness)",
            "Aqeedah",
            "Weekly stories of the Prophets, Sahabah and the righteous",
          ],
        },
        {
          title: "Qur’anic Arabic (older students)",
          items: ["Basic grammar", "Common Qur’anic vocabulary", "Short ayahs and their translations"],
        },
      ],
    },
    teaching: liveList([
      "Live interactive Zoom classes with screen sharing and whiteboards",
      "Individual attention",
      "Daily review",
      "Daily homework with evening support",
      "Regular feedback to parents",
    ]),
    certificate: { status: "pending", value: null },
    teachers: {
      status: "live",
      ids: [
        "mufti-ariful-islam",
        "ustad-alauddin-khilzi",
        "mawlana-nazrul-islam",
        "ustadha-maha-rashed",
        "hafezah-nuha-rashed",
        "mufti-muhammad-faijullah",
      ],
    },
  },
};

/** Open items for the Summer program (COURSE-CONTENT.md §9.2, C5). */
export const summerOpen = {
  /** The live page says both "6–7 PM CDT" and "6–10 PM CST"; the owner confirms one. */
  homeworkSupportHours: pending,
  /** Not announced yet. */
  dates2027: pending,
  /** The 2026 results page moves from /summer-program-results/ to here at launch. */
  resultsHref: "/results/summer-2026",
} as const;

/* ── Validation and lookup ───────────────────────────────────────────────── */

const schema = courseContentSchema(instructorIds);

function check(copy: Record<string, CourseContent>, ids: string[], what: string) {
  const keys = Object.keys(copy);
  const missing = ids.filter((id) => !keys.includes(id));
  const extra = keys.filter((id) => !ids.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`${what} copy and ./pricing disagree. Missing copy: ${missing.join(", ") || "none"}; no price entry: ${extra.join(", ") || "none"}.`);
  }
  for (const [key, value] of Object.entries(copy)) {
    if (value.id !== key) throw new Error(`${what} copy "${key}" has id "${value.id}"`);
    schema.parse(value);
  }
}
check(courseCopy, monthlyCourses.map((c) => c.id), "Course");
check(programCopy, Object.values(programs).map((p) => p.id), "Program");

export type Course = MonthlyCourse & { content: CourseContent };

/** Every catalog course with its copy, in catalog order. */
export const courses: Course[] = monthlyCourses.map((c) => ({ ...c, content: courseCopy[c.id] }));

export type Program = (typeof programs)[keyof typeof programs] & { content: CourseContent };

/** Both programs with their copy (Weekend, then Summer). */
export const programList: Program[] = Object.values(programs).map((p) => ({ ...p, content: programCopy[p.id] }));

export function courseContent(id: CourseId): CourseContent {
  return courseCopy[id];
}

export function programContent(id: ProgramId): CourseContent {
  return programCopy[id];
}
