import { programsCta } from "./catalog";
import { shown, shownList } from "./course-page";
import { programList, summerOpen, type Program } from "./courses";
import { faq as homeFaq, familiesSection, programsSection, progressSection } from "./home";
import {
  currentSeason,
  daysInWords,
  programTimetables,
  seasonDates,
  seasonState,
  upcomingYear,
  wallTimeRange,
  type ProgramTimetable,
  type SeasonState,
} from "./program-timetable";
import { programs, usd, type ProgramId } from "./pricing";
import { testimonials, type Testimonial } from "./testimonials";

/*
 * The program pages, /programs/weekend-ilm-program and
 * /programs/summer-ilm-camp (spec §7.11; COURSE-CONTENT.md §9;
 * CONTENT-ADDENDUM.md §5; plan approved by the owner, 23 Nov 2026). One
 * template for both: this file turns a program's copy, timetable and price
 * into what the page shows, and leaves out anything pending.
 *
 * Never on these pages: a certificate claim (COURSE-CONTENT.md C3), the
 * free first month or "Start free trial" (monthly courses only), a
 * countdown or seat count (no real deadline or number), a sibling discount
 * (none exists), the reduced Summer amount (shown only inside the enrolment
 * flow, owner 19 Nov 2026), ratings, or the teacher-gender rule (owner,
 * 23 Nov 2026: the Weekend list has male teachers only, so program pages
 * show one ungrouped row and state no rule).
 */

/* ── The program and its state ───────────────────────────────────────────── */

export function programBySlug(slug: string): Program | undefined {
  return programList.find((p) => p.id === slug);
}

export function timetableOf(program: Program): ProgramTimetable {
  return programTimetables[program.id];
}

export function stateOf(program: Program): SeasonState {
  return seasonState(timetableOf(program));
}

const weekend = programList.find((p) => p.id === programs.weekend.id)!;

/** The enrolment form for a program (the staged flow, planned at /enroll). */
export const enrolHref = (id: ProgramId) => `/enroll?program=${id}`;

/**
 * Each program's own button label (owner, 23 Nov 2026): it always says where
 * it goes. The generic "Enroll in a program" stays on /courses only.
 */
const ENROL_LABEL: Record<ProgramId, string> = {
  "weekend-ilm-program": "Enroll in the Weekend program",
  "summer-ilm-camp": "Enroll in Summer camp",
};
const JOIN_WEEKEND = "Join the Weekend program";

/**
 * The page's one filled button, or null between seasons (Summer with no
 * next-run dates: no enrol button in the hero or the card).
 */
export function enrolOf(program: Program): { label: string; href: string } | null {
  if (stateOf(program) === "between") return null;
  return { label: ENROL_LABEL[program.id], href: enrolHref(program.id) };
}

export const askOf = (program: Program) => ({ label: "Ask a question", href: `/contact?program=${program.id}` });

/** The footer's newsletter card (NewsletterCard, heading id "newsletter-title"). */
export const hearFirst = { label: "Hear first", href: "#newsletter-title" } as const;

/**
 * Between seasons the card also points to the program that runs now, the
 * same offer as the final band (owner, 23 Nov 2026), so it is in reach at
 * the moment of intent and not only at the bottom of the page.
 */
export function alternativeOf(program: Program): { label: string; href: string } | null {
  return stateOf(program) === "between" ? { label: "The Weekend program runs all year", href: weekend.href } : null;
}

/** "2027 dates coming soon" while between seasons; null otherwise. */
export function comingSoonOf(program: Program): string | null {
  const t = timetableOf(program);
  return seasonState(t) === "between" ? `${upcomingYear(t)} dates coming soon` : null;
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

/**
 * "Saturday and Sunday, 10–11 AM CT". Between seasons it names the year it
 * describes ("In 2026: …"), so the last run's schedule never reads as a
 * promise for the next (critique, 23 Nov 2026).
 */
export function whenLine(program: Program): string {
  const t = timetableOf(program);
  const line = `${daysInWords(t.days)}, ${wallTimeRange(t.start, t.end)} ${t.zoneLabel}`;
  const season = currentSeason(t);
  return seasonState(t) === "between" && season ? `In ${season.year}: ${line}` : line;
}

/**
 * The hero fact row: ages, length, days and time (with its zone), format.
 * Between seasons only what holds for any year (ages, format); the last
 * run's length, days and time move to the past-tense season line.
 */
export function heroFacts(program: Program): string[] {
  const t = timetableOf(program);
  const season = currentSeason(t);
  const zoom = "Live on Zoom"; // courseRules.format (live): "All classes are online, live on Zoom."
  if (seasonState(t) === "between") return [`Ages ${program.ages}`, zoom];
  return [
    `Ages ${program.ages}`,
    ...(season ? [`${season.weeks} weeks`] : []),
    daysInWords(t.days),
    `${wallTimeRange(t.start, t.end)} ${t.zoneLabel}`,
    zoom,
  ];
}

/**
 * The season line under the facts. Weekend: none. Summer open: the next
 * run's dates. Between seasons: the last run, in the past tense.
 */
export function seasonLine(program: Program): string | null {
  const t = timetableOf(program);
  const season = currentSeason(t);
  if (!season) return null;
  if (seasonState(t) === "open") return `${seasonDates(season)}`;
  return `The ${season.year} camp ran ${season.weeks} weeks, ${seasonDates(season)}, ${whenLine(program).replace(/^In \d{4}: /, "")}.`;
}

/** True when the hero should show the class time in the visitor's own zone (not for a past run). */
export function showsLocalTime(program: Program): boolean {
  return stateOf(program) !== "between";
}

/* ── Price ───────────────────────────────────────────────────────────────── */

export type PriceDisplay = { amount: string; unit: string | null; note: string };

export function priceOf(program: Program): PriceDisplay {
  if (program.fee === 0) return { amount: "Free", unit: null, note: "For every child, no payment" };
  // Owner, 19 Nov 2026: the reduced amount appears only in the enrolment flow.
  return { amount: usd(program.fee), unit: "one-time", note: `For the whole camp · ${programsSection.summerPriceNote}` };
}

/** Under the fee in the Fees section. PLUGIN-INVENTORY §1 and §2.4; ADDENDUM §5. */
export function feeNotes(program: Program): string[] {
  if (program.fee === 0) {
    // ADDENDUM §5 "fully free"; PLUGIN-INVENTORY §1 "no payment"; "runs all year": owner, 23 Nov 2026.
    return [
      "The Weekend Ilm Program is fully free, for every child.",
      "No payment is taken at any point.",
      "It runs all year, every Saturday and Sunday.",
    ];
  }
  const season = currentSeason(timetableOf(program));
  return [
    // A non-breaking hyphen keeps "8-week" on one line.
    `One payment covers the whole ${season ? `${season.weeks}‑week ` : ""}camp.`,
    "A reduced option is offered when you enroll.",
    "Fees are in US dollars, for each child.",
  ];
}

/* ── Sections and the sub-nav ────────────────────────────────────────────── */

export type ProgramSectionId = "overview" | "schedule" | "curriculum" | "teachers" | "fees" | "results" | "families" | "faq";

const SECTION_LABELS: Record<ProgramSectionId, string> = {
  overview: "Overview",
  schedule: "Schedule",
  curriculum: "Curriculum",
  teachers: "Teachers",
  fees: "Fees",
  results: "2026 results",
  families: "Families",
  faq: "FAQ",
};

export function sectionsOf(program: Program): { id: ProgramSectionId; label: string }[] {
  const r = resultsOf(program);
  const present: Record<ProgramSectionId, boolean> = {
    overview: overviewText(program) !== null || teachingOf(program).length > 0,
    schedule: true,
    curriculum: program.content.curriculum !== undefined && program.content.curriculum.kind !== "pending",
    teachers: teachersIds(program).length > 0,
    fees: true,
    results: r !== null,
    families: familiesOf(program).length > 0,
    faq: true,
  };
  return (Object.keys(SECTION_LABELS) as ProgramSectionId[])
    .filter((id) => present[id])
    // The nav label matches the section heading ("How the 2026 camp was assessed").
    .map((id) => ({ id, label: id === "results" && r ? `${r.year} assessment` : SECTION_LABELS[id] }));
}

/* ── Overview ────────────────────────────────────────────────────────────── */

// The owner's equipment answer (19 Nov 2026), shared with the Home FAQ and the course pages.
const equipment = (() => {
  const item = homeFaq.items.find((i) => i.q === "What do we need for classes?");
  if (!item) throw new Error("The Home FAQ no longer has the equipment answer");
  return item;
})();

/** Lines of the live schedule list that describe teaching, not time or age (Weekend: "Live, interactive…"). */
function teachingLines(program: Program): string[] {
  const teaching = shownList(program.content.teaching);
  if (teaching.length > 0) return teaching;
  return shownList(program.content.schedule).filter((line) => /^live\b/i.test(line));
}

/** Beside the teaching list. No separate format block: the hero fact and this answer already say "live on Zoom". */
export const overviewBlocks: { label: string; text: string }[] = [{ label: "What you need", text: equipment.a }];

export function teachingOf(program: Program): string[] {
  return teachingLines(program).map((line) => line.replace(/\.$/, ""));
}

export function overviewText(program: Program): string | null {
  return shown(program.content.overview);
}

/** The overview's first sentence: the hero's opening line and the meta description. */
export function leadOf(program: Program): string {
  const text = overviewText(program) ?? program.label;
  const first = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim();
  return first ?? text;
}

/** The search description: the meta where there is one, else the lead sentence, cut at a word to 160 characters. */
export function descriptionOf(program: Program): string {
  const text = shown(program.content.meta) ?? leadOf(program);
  if (text.length <= 160) return text;
  const cut = text.slice(0, 159);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/* ── Schedule ────────────────────────────────────────────────────────────── */

export function scheduleOf(program: Program) {
  const t = timetableOf(program);
  const state = seasonState(t);
  const season = currentSeason(t);
  const isSummer = program.id === programs.summer.id;
  return {
    timetable: t,
    heading: state === "between" && season ? `How the ${season.year} camp ran` : "When it meets",
    dates: season ? seasonDates(season) : null,
    weeks: season?.weeks ?? null,
    comingSoon: comingSoonOf(program),
    // The levels are Summer's only (PLUGIN-INVENTORY §1); Weekend is one group of ages 5–12.
    levels: isSummer
      ? [
          { name: "Level 1", ages: "Ages 5–10" },
          { name: "Level 2", ages: "Ages 11–15" },
        ]
      : null,
    // Live: "Evening homework support". The hours are pending (COURSE-CONTENT.md C5), so none are shown.
    // Weekend: "one hour per session" (live).
    extras: isSummer ? [{ label: "Homework", value: "Evening support" }] : [{ label: "Each session", value: "One hour" }],
    onDate: season?.start,
    homeworkHours: shown(summerOpen.homeworkSupportHours),
  };
}

/* ── Teachers ────────────────────────────────────────────────────────────── */

function teachersIds(program: Program): string[] {
  const t = program.content.teachers;
  return t.status === "pending" ? [] : t.ids;
}

/* ── 2026 results (Summer only) ──────────────────────────────────────────── */

/**
 * The live results page (read 20 Nov 2026; Home "Progress" proof): five
 * subjects, 20 marks each. Off-site until /results/summer-2026 exists.
 */
export function resultsOf(program: Program) {
  if (program.id !== programs.summer.id) return null;
  const last = programTimetables["summer-ilm-camp"].seasons?.last;
  if (!last) return null;
  const proof = progressSection.proof;
  return {
    year: last.year,
    title: proof.title,
    text: proof.text,
    // The subjects and marks as written in proof.text.
    subjects: ["Quran & Tajweed", "Aqeedah", "Fiqh", "Akhlaq", "Seerah"],
    marksEach: 20,
    link: { label: proof.link.label, href: summerOpen.liveResultsHref },
  };
}

/* ── Families ────────────────────────────────────────────────────────────── */

export const familiesHeading = familiesSection.heading;

/** That program's testimonials (all "sample" for now: shown for admin review). At most three. */
export function familiesOf(program: Program): Testimonial[] {
  return testimonials.filter((t) => t.program === program.id).slice(0, 3);
}

/* ── FAQ (draft: each answer restates a fact on this page) ───────────────── */

type ProgramFaq = { status: "draft" | "live"; q: string; a: string };

/*
 * Language: the live course records list English for both programs (the
 * Language column of the courses table), so the answer is English only, never
 * the four languages of the one-on-one courses.
 */
// Spec §2.2 "Content types" (the live course meta).
const LANGUAGE_FAQ: ProgramFaq = {
  status: "draft",
  q: "What language are classes taught in?",
  a: "English.",
};

/**
 * PRODUCT.md "Users": the parent's fourth question. Only the organisation
 * knows the steps after the enrolment form, so this stays pending (listed by
 * content:check) and renders once the owner supplies the answer.
 */
export const afterEnrolFaq = { status: "pending", q: "What happens after I enroll?", a: null } as const;

export const weekendFaq: ProgramFaq[] = [
  // Final (owner, 27 Nov 2026: the /faq answers approved). The time answer below
  // stays draft: /faq approved only its first sentence (faq.ts weekend-times).
  { status: "live", q: "Does the Weekend Ilm Program cost anything?", a: "No. It is free for every child, and no payment is taken." },
  {
    status: "draft",
    q: "What time are the classes where we live?",
    a: "Saturday and Sunday, 10–11 AM Central Time (CT), one hour per session. The schedule above shows the same time in your own zone.",
  },
];

export const summerFaq: ProgramFaq[] = [
  {
    // Final (owner, 27 Nov 2026: the /faq answers approved).
    status: "live",
    q: "What does Summer Ilm Camp cost?",
    a: `${usd(programs.summer.fee)}, paid once, for the whole camp. A reduced option is offered when you enroll.`,
  },
  { status: "live", q: "Which level will my child join?", a: "Level 1 is for ages 5–10, and Level 2 is for ages 11–15." },
  { status: "live", q: "Is there homework?", a: "Yes. Children have daily homework, with support in the evening." },
];

/**
 * The program's questions. `newsletterOpen` is whether the footer's sign-up
 * form works (every Brevo setting present): the "when is the next camp"
 * answer only sends families to it when it does (critique, 23 Nov 2026).
 */
export function faqFor(program: Program, newsletterOpen: boolean): { q: string; a: string }[] {
  const items: { q: string; a: string }[] = program.id === programs.weekend.id ? [...weekendFaq] : [...summerFaq];
  const after = afterEnrolFaq as { q: string; a: string | null };
  if (after.a) items.unshift({ q: after.q, a: after.a });
  items.push(LANGUAGE_FAQ);
  const soon = comingSoonOf(program);
  const year = upcomingYear(timetableOf(program));
  if (soon && year) {
    items.push({
      q: `When is the ${year} camp?`,
      a: newsletterOpen
        ? `The ${year} dates are not announced yet. Join the newsletter at the bottom of this page to hear first.`
        : `The ${year} dates are not announced yet. They will be on this page as soon as they are set.`,
    });
  }
  items.push({ q: equipment.q, a: equipment.a });
  return items;
}

/* ── Where next ──────────────────────────────────────────────────────────── */

/** The other program, as a row: name, ages and length, price. */
export function otherProgramOf(program: Program) {
  const other = programList.find((p) => p.id !== program.id)!;
  const price = priceOf(other);
  return {
    label: other.label,
    href: other.href,
    meta: other.id === programs.weekend.id ? programsSection.weekendMeta : programsSection.summerMeta,
    price: price.unit ? `${price.amount} ${price.unit}` : price.amount,
  };
}

/* ── Final band and phone bar ────────────────────────────────────────────── */

/**
 * The final band (owner, 23 Nov 2026). Weekend: its own button. Summer
 * between seasons: the dates are coming soon, so the band offers the Weekend
 * program, which runs all year. Summer open: "Enroll in Summer camp".
 */
export function finalCtaOf(program: Program) {
  const state = stateOf(program);
  if (state === "between") {
    return programsCta({
      heading: `Summer ${upcomingYear(timetableOf(program))} dates are coming soon.`,
      reassurance: "The Weekend Ilm Program runs all year.",
      label: JOIN_WEEKEND,
      href: enrolHref(weekend.id),
    });
  }
  if (program.id === programs.weekend.id) {
    return programsCta({
      heading: `Free weekend classes for ages ${program.ages}.`,
      reassurance: `${whenLine(program)}, live on Zoom. No fee.`,
      label: ENROL_LABEL[program.id],
      href: enrolHref(program.id),
    });
  }
  const season = currentSeason(timetableOf(program));
  return programsCta({
    heading: `Summer Ilm Camp ${season?.year ?? ""}, for ages ${program.ages}.`.replace("  ", " "),
    reassurance: `${season ? `${seasonDates(season)}. ` : ""}A one-time ${usd(program.fee)} fee, with a reduced option.`,
    label: ENROL_LABEL[program.id],
    href: enrolHref(program.id),
  });
}

/** The phone bottom bar: the same button as the final band, with a short title and one line. */
export function stickyOf(program: Program) {
  const final = finalCtaOf(program);
  const state = stateOf(program);
  const price = priceOf(program);
  // Short titles that may wrap to two lines beside the long, specific button labels
  // (critique, 23 Nov 2026: the program name was cut to "We…" at 375). No second line.
  if (state === "between") return { label: final.button.label, href: final.button.href, title: comingSoonOf(program)! };
  if (program.fee === 0) return { label: final.button.label, href: final.button.href, title: "Free" };
  return { label: final.button.label, href: final.button.href, title: `${price.amount} ${price.unit ?? ""}`.trim() };
}

/* ── Structured data ─────────────────────────────────────────────────────── */

export function seasonForSchema(program: Program) {
  const t = timetableOf(program);
  return seasonState(t) === "open" ? currentSeason(t) : null;
}
