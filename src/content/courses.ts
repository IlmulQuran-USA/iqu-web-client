import { draft, draftList, live, liveList, pending } from "./copy";
import { instructorIds } from "./instructors";
import { livePaths } from "./legacy-paths";
import { monthlyCourses, programs, type CourseId, type MonthlyCourse, type ProgramId } from "./pricing";
import { courseContentSchema, type CourseContent } from "./types";

/*
 * Course and program copy, from docs/spec/COURSE-CONTENT.md §1–§9 and
 * docs/spec/CONTENT-ADDENDUM.md §3 and §5 (owner, 20 Nov 2026). Where the
 * two differ, the addendum wins. Names, slugs and prices are not here: they come from
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

/**
 * Who teaches whom (owner, 20 Nov 2026: boys up to age 10 can learn with a
 * female teacher). The one wording used everywhere: course pages, FAQs and
 * the teacher-matching line.
 */
const TEACHER_RULE = "Brothers learn with male teachers. Sisters, and boys up to age 10, can learn with a female teacher.";

export const courseRules = {
  // Owner, 20 Nov 2026: "small group" everywhere, never "batch".
  format: live("All classes are online, live on Zoom. Students choose one-on-one or a small group."),
  teacherAssignment: live(TEACHER_RULE),
  certificate: live("A certificate is awarded at the end of every course."),
  languages: live("Classes are taught in English, Bengali, Arabic and Urdu."),
  learningPath: live(
    "Noorani Qaidah, then Quran Nazirah (reading the Quran), then Quran Hifz. Nazirah is the reading stage that comes before Hifz.",
  ),
} as const;

/* ── §3–§8 · Courses ─────────────────────────────────────────────────────── */

const courseCopy: Record<CourseId, CourseContent> = {
  "noorani-qaidah": {
    id: "noorani-qaidah",
    livePath: livePaths["noorani-qaidah"],
    meta: live(
      "The perfect starting point for beginners. Learn Arabic letters, pronunciation and Tajweed basics before reading the Quran.",
    ),
    overview: live(
      "For beginners who want to learn to read the Quran with proper pronunciation and Tajweed. It builds a strong foundation in recognizing Arabic letters, joining words and articulating each sound correctly.",
    ),
    audience: live("Children and adults starting from the beginning."),
    // The 48-class plan below (live).
    duration: live("48 classes"),
    highlights: liveList([
      "Step by step, from single letters to complete words",
      "Correct pronunciation and Tajweed rules",
      "Interactive, engaging teaching methods",
      "Qualified male and female teachers",
      "One-on-one or small group, on a flexible schedule",
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
    // Owner, 20 Nov 2026: both teach reading foundations to children and beginners (§10 profiles).
    // Hafez Nurul Ahsan from his own live bio (owner's assistant, 22 Nov 2026).
    profileTeachers: { status: "draft", ids: ["shifa-jalal", "afra-humayra", "hafez-nurul-ahsan"] },
  },

  "quran-nazirah": {
    id: "quran-nazirah",
    livePath: livePaths["quran-nazirah"],
    meta: live(
      "Learn to recite the Quran fluently with correct Tajweed. Online Nazirah classes for brothers and sisters of all ages.",
    ),
    overview: live(
      "Online Quran Nazirah (recitation) classes for brothers and sisters of all ages. Students develop fluency in reading the Quran with proper Tajweed, guided by qualified male and female teachers.",
    ),
    placement: live("Nazirah is reading the Quran itself, after the Qaidah and before Hifz."),
    audience: live("Students who have completed the Noorani Qaidah or can already read Arabic letters with harakat."),
    highlights: liveList([
      "Fluent reading of the Quran with correct Tajweed",
      "Tajweed rules: proper articulation and pronunciation",
      "One-on-one or group classes, on your schedule",
      // The live highlight, with the owner's exact rule (20 Nov 2026).
      TEACHER_RULE,
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
          title: "Reading through the Quran",
          text: "The student reads aloud to the teacher, portion by portion, juz by juz. The teacher listens, corrects pronunciation and Tajweed on the spot, and sets the next portion.",
        },
        {
          title: "Fluency and completion",
          text: "Steady pace, correct stops (waqf) and Tajweed applied without prompting, working toward a complete reading (khatm) of the Quran.",
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
        "maha-rashed",
        "najiba-mahzabin-jeba",
        "mufti-ahmed-mostafa-raian",
        "mufti-shaker-waliullah",
        "mufti-mushfiqur-rahman",
        "mufti-shamsuddin-rois",
      ],
    },
    // Not on the live page: four teachers with no live course, from their own live bios
    // (owner's assistant, 22 Nov 2026).
    profileTeachers: {
      status: "draft",
      ids: ["mufti-sajidullah", "mufti-jubayer-bin-jalaluddin", "hafez-nurul-ahsan", "hafezah-humayra-afrin"],
    },
  },

  "quran-hifz": {
    id: "quran-hifz",
    livePath: livePaths["quran-hifz"],
    meta: live(
      "Memorize the Holy Quran with proper Tajweed and fluency. Structured online Hifz classes with qualified Huffaz for children and adults.",
    ),
    overview: live(
      "For students who wish to memorize the Holy Quran with proper Tajweed and fluency. A structured approach lets each student memorize at their own pace under the supervision of qualified teachers. One-on-one and small-group classes are available.",
    ),
    audience: live("Students who can read the Quran fluently (Nazirah level)."),
    highlights: liveList([
      "100% online, with flexible scheduling",
      "A personal memorization plan based on each student’s capability",
      "Emphasis on Tajweed and correct pronunciation",
      "Daily revision and retention techniques",
      "Experienced male and female teachers",
      "One-on-one and small-group options",
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
      "The student usually starts with Juz ‘Amma, then moves through the Quran juz by juz.",
      "The daily amount grows with the student’s ability.",
      "Teachers set homework revision between classes.",
    ]),
    certificate: { status: "live", value: true },
    teachers: { status: "live", ids: ["mawlana-mouinul-islam", "mawlana-nazrul-islam"] },
    // Owner, 20 Nov 2026: all four list memorization in their §10 profiles. Then Mufti
    // Sajidullah, Mufti Jubayer bin Jalaluddin and Hafez Nurul Ahsan from their own live
    // bios (owner's assistant, 22 Nov 2026).
    profileTeachers: {
      status: "draft",
      ids: [
        "maha-rashed",
        "hafezah-nuha-rashed",
        "hafezah-humayra-afrin",
        "najiba-mahzabin-jeba",
        "mufti-sajidullah",
        "mufti-jubayer-bin-jalaluddin",
        "hafez-nurul-ahsan",
      ],
    },
  },

  "quranic-arabic-level-1": {
    id: "quranic-arabic-level-1",
    // For adults: the page addresses the student as "you" (owner, 20 Nov 2026).
    forAdults: true,
    livePath: livePaths["quranic-arabic-level-1"],
    meta: live(
      "Understand up to 80% of the Quran by listening and reading. Grammar, vocabulary and practice in one structured online program.",
    ),
    overview: live(
      "Master the fundamentals of Quranic Arabic. The program combines grammar, vocabulary and practical Quranic application to build a deep, lasting connection with the Book of Allah, in sha’ Allah.",
    ),
    // Present as the course's aim, never as a guarantee (COURSE-CONTENT.md §6).
    objective: live(
      "To understand at least 80% of Quranic verses through listening and reading within one year, in sha’ Allah.",
    ),
    audience: live("Students who can read the Quran fluently with harakat and sukun. No prior Arabic grammar is needed."),
    // Owner, 20 Nov 2026. The fee is the 4-day fee in ./pricing.
    duration: live("One year"),
    schedule: liveList(["Four days a week, for one year."]),
    highlights: liveList([
      "Practical, Quran-focused learning",
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
          goal: "Core grammar and vocabulary for basic Quranic structures.",
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
          practice: "Short Quranic phrases, Juz ‘Amma vocabulary, simple translation and tafsir exercises.",
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
            "Common Quranic particles",
          ],
          practice: "Short ayahs from Juz 30 and 29, 500 common Quranic words, root extraction.",
        },
        {
          title: "Advanced grammar and Quranic style",
          months: "Months 7–9",
          goal: "Quranic expressions and complex grammar.",
          topics: [
            "Verb forms I–X",
            "Conditionals and relative clauses",
            "Kana and its sisters",
            "Inna and its sisters",
            "Quranic emphasis",
            "An introduction to balaghah",
          ],
          practice: "Ayah analysis, longer passages, comparative meaning analysis.",
        },
        {
          title: "Full Quranic immersion",
          months: "Months 10–12",
          goal: "Direct comprehension and analysis of Quranic verses.",
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
      "Understand about 80% of the Quranic text through listening and reading",
      "Translate and analyze a wide range of Quranic passages",
      "A foundation for advanced study",
    ]),
    note: live("Ilm-Ul-Quran USA may adjust the curriculum to better meet students’ needs."),
    certificate: { status: "live", value: true },
    teachers: { status: "live", ids: ["mufti-muaj-al-juhany", "mawlana-nazrul-islam"] },
  },

  "tarjumatul-quran": {
    id: "tarjumatul-quran",
    forAdults: true,
    livePath: livePaths["tarjumatul-quran"],
    // No live meta (COURSE-CONTENT.md §7): written from the overview below (owner to confirm).
    meta: draft(
      "Understand what you recite. Tarjumatul Quran teaches the meaning of the Quran, word by word and ayah by ayah, in live online classes.",
    ),
    // Owner, 20 Nov 2026.
    placement: live("Tarjumatul Quran teaches only the meaning of the Quran."),
    overview: draft(
      "Understand what you recite. Tarjumatul Quran teaches the meaning of the Quran, word by word and ayah by ayah, so students follow what they read in salah and in recitation. The course covers meaning only; recitation and memorization are taught in Nazirah and Hifz.",
    ),
    audience: draft("Students who can already read the Quran."),
    certificate: { status: "live", value: true },
    // CONTENT-ADDENDUM.md §3.2 (draft): every teacher whose profile lists Quran translation.
    teachers: {
      status: "draft",
      ids: [
        "mufti-sajidullah",
        "mufti-jubayer-bin-jalaluddin",
        "alauddin-khilzi",
        "jawadul-islam-khan-jami",
        "mawlana-nazrul-islam",
        "najiba-mahzabin-jeba",
      ],
    },
  },

  "islamic-studies": {
    id: "islamic-studies",
    livePath: livePaths["islamic-studies"],
    // CONTENT-ADDENDUM.md §3.1 (draft). The page stays noindex, and out of
    // the sitemap, until its overview is live (owner, 20 Nov 2026). Never
    // borrow the Weekend program's curriculum.
    noindex: true,
    // No live meta: written from the draft overview and topics below (owner to confirm).
    meta: draft(
      "Islamic Studies for children, teens and adults: Aqeedah, worship, Seerah and Akhlaq, taught live online by qualified ‘Ulama and Muftis.",
    ),
    overview: draft(
      "Islamic Studies gives children, teens and adults a clear, practical grounding in their faith: what Muslims believe, how to worship correctly and how to live with good character. It is taught by qualified ‘Ulama and Muftis.",
    ),
    audience: draft(
      "Anyone who wants structured Islamic knowledge alongside their Quran classes. Lessons are pitched to the student’s age and level.",
    ),
    curriculum: {
      kind: "topics",
      status: "draft",
      groups: [
        { title: "Aqeedah", items: ["The six pillars of Iman and Tawheed"] },
        { title: "Fiqh of worship", items: ["Purification, wudu, salah, fasting, zakah and Hajj"] },
        { title: "Seerah", items: ["The life of the Prophet ﷺ"] },
        { title: "Stories", items: ["The Prophets and the Sahabah"] },
        { title: "Akhlaq and Adab", items: ["Character and manners"] },
        { title: "Daily life", items: ["Duas and adhkar"] },
        { title: "Advanced students", items: ["Selected topics in Hadith and Tafsir"] },
      ],
    },
    certificate: { status: "live", value: true },
    // CONTENT-ADDENDUM.md §3.1 (draft, from their profiles).
    teachers: {
      status: "draft",
      ids: [
        "mufti-ariful-islam",
        "mufti-mushfiqur-rahman",
        "mufti-shamsuddin-rois",
        "mawlana-nazrul-islam",
        "mufti-sajidullah",
      ],
    },
  },
};

/* ── §9 · Programs ───────────────────────────────────────────────────────── */

const programCopy: Record<ProgramId, CourseContent> = {
  "weekend-ilm-program": {
    id: "weekend-ilm-program",
    livePath: livePaths["weekend-ilm-program"],
    meta: pending,
    overview: live(
      "Essential Islamic knowledge for children aged 5–12, in an engaging and structured way. In live online weekend classes, students learn Quran recitation with Tajweed, foundational beliefs (Aqeedah), Islamic manners (Akhlaq), basic Fiqh, and selected duas and surahs for daily life. Taught by qualified, caring teachers, the program helps children build a strong Islamic identity, deepen their connection to Allah and practice Islam confidently, in sha’ Allah.",
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
          title: "Quran and Tajweed",
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
    teachers: { status: "live", ids: ["mufti-ariful-islam", "alauddin-khilzi", "mawlana-nazrul-islam"] },
  },

  "summer-ilm-camp": {
    id: "summer-ilm-camp",
    // Live name: Summer Islamic Education Program.
    livePath: livePaths["summer-ilm-camp"],
    // The live overview's sentence runs to 167 characters (search limit 160): shortened, with the ages added (draft).
    meta: draft(
      "An online summer program that keeps children aged 5–15 connected to the Quran and Islamic learning during their summer break, with qualified teachers.",
    ),
    overview: live(
      "An online summer program that keeps children connected to the Quran and Islamic learning during their summer break, with qualified teachers in a nurturing environment.",
    ),
    // 2026 dates and schedule: CONTENT-ADDENDUM.md §5 (live, the Summer
    // Program page, which replaces the old course post). Ages and levels:
    // PLUGIN-INVENTORY §1.
    schedule: liveList([
      "1 Jun – 31 Jul 2026, 8 weeks.",
      "Monday–Thursday, 10 AM–12 PM CT.",
      "Evening homework support.",
      "Ages 5–15, in two levels: Level 1 for ages 5–10, Level 2 for ages 11–15.",
    ]),
    curriculum: {
      kind: "topics",
      status: "live",
      groups: [
        {
          title: "Quran studies",
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
          title: "Quranic Arabic (older students)",
          items: ["Basic grammar", "Common Quranic vocabulary", "Short ayahs and their translations"],
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
        "alauddin-khilzi",
        "mawlana-nazrul-islam",
        "maha-rashed",
        "hafezah-nuha-rashed",
        "mufti-muhammad-faijullah",
      ],
    },
  },
};

/** Open items for the Summer program (COURSE-CONTENT.md §9.2, C5). */
export const summerOpen = {
  /** The live page says both "6–7 PM CDT" and "6–10 PM CST"; the owner confirms one. Show it as CT, never CST/CDT. */
  homeworkSupportHours: pending,
  // The 2027 dates live in ./program-timetable (seasons.next), where entering them reopens enrolment.
  /** The 2026 results page moves from /summer-program-results/ to here at launch. */
  resultsHref: "/results/summer-2026",
  /** Linked until resultsHref exists (Home "Progress" proof uses the same page). */
  liveResultsHref: "https://ilmulquranus.org/summer-program-results/",
} as const;

/* ── Course page FAQs and teacher matching (CONTENT-ADDENDUM.md §3.3–§3.4) ── */

/** The same five questions on every course page, worded as in the addendum (draft). */
export const courseFaq = [
  {
    // Owner's wording, 20 Nov 2026.
    status: "live",
    q: "Can I choose a male or female teacher?",
    a: `Yes. ${TEACHER_RULE} Tell us your preference when you enroll.`,
  },
  { status: "draft", q: "One-on-one or group?", a: "Both. Choose one-on-one or a small group when you enroll." },
  {
    status: "draft",
    q: "What if a class is cancelled?",
    // Tuition & Refund Policy, 16 Nov 2026 (CONTENT-ADDENDUM.md §2). Never promise make-ups beyond it.
    a: "If your teacher or we cancel a class and it isn’t made up, it is refunded or taken off your next month.",
  },
  { status: "draft", q: "Is there a certificate?", a: "Yes, at the end of the course." },
  {
    status: "draft",
    q: "Can we change days or the course later?",
    a: "Yes. The new monthly amount starts on the next 1st of the month, and we confirm it with you first.",
  },
] as const;

/**
 * "We match you with a teacher" (CONTENT-ADDENDUM.md §3.4, draft), with the
 * owner's exact rule on teacher gender (20 Nov 2026) in place of the
 * addendum's "girls and young children".
 */
export const teacherMatching = {
  status: "draft",
  text: `We match by the student’s level, the teacher gender the family prefers and the days and times that suit the family. ${TEACHER_RULE}`,
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
