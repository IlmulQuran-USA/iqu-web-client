import { pending } from "./copy";
import type { ProgramId } from "./pricing";

/*
 * When each program meets, as structured data (owner plan, 23 Nov 2026), so
 * the week strip and the visitor's-own-time line read fields instead of
 * parsing sentences. The sentences in ./courses (programCopy.schedule) say
 * the same thing in words; keep the two in step.
 *
 * Sources: CONTENT-ADDENDUM.md §5 (live): Weekend, Saturday and Sunday,
 * 10–11 AM CT; Summer 2026, 8 weeks, Monday–Thursday, 10 AM–12 PM CT,
 * 1 Jun – 31 Jul 2026. Summer 2027 dates: pending (§6).
 *
 * Times are wall-clock times in Central Time. The label is the year-round
 * "CT", never CST or CDT (CLAUDE.md §4).
 */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** One run of a seasonal program. Dates are ISO (yyyy-mm-dd). */
export type Season = { status: "live"; year: number; start: string; end: string; weeks: number };

export type ProgramTimetable = {
  status: "live";
  days: readonly Weekday[];
  /** "10:00", 24-hour, in `zone`. */
  start: string;
  end: string;
  zone: "America/Chicago";
  zoneLabel: "CT";
  /**
   * null: the program runs all year (Weekend). Otherwise the last run and the
   * next. While `next` is pending the page is "between seasons": the last run
   * is told in the past tense and there is no enrol button. Enter the next
   * run's dates here and the enrol button comes back on its own (owner,
   * 23 Nov 2026). If the next run changes days or times, change `days`,
   * `start` and `end` too.
   */
  seasons: null | { last: Season | null; next: Season | typeof pending };
};

export const programTimetables: Record<ProgramId, ProgramTimetable> = {
  "weekend-ilm-program": {
    status: "live",
    days: ["Sat", "Sun"],
    start: "10:00",
    end: "11:00",
    zone: "America/Chicago",
    zoneLabel: "CT",
    seasons: null,
  },
  "summer-ilm-camp": {
    status: "live",
    days: ["Mon", "Tue", "Wed", "Thu"],
    start: "10:00",
    end: "12:00",
    zone: "America/Chicago",
    zoneLabel: "CT",
    seasons: {
      last: { status: "live", year: 2026, start: "2026-06-01", end: "2026-07-31", weeks: 8 },
      // CONTENT-ADDENDUM.md §6: not announced yet. Never invent dates.
      next: pending,
    },
  },
};

export type SeasonState = "all-year" | "open" | "between";

export function seasonState(t: ProgramTimetable): SeasonState {
  if (!t.seasons) return "all-year";
  return t.seasons.next.status === "live" ? "open" : "between";
}

/** The run the page is about: the next one when its dates are in, otherwise the last. */
export function currentSeason(t: ProgramTimetable): Season | null {
  if (!t.seasons) return null;
  return t.seasons.next.status === "live" ? t.seasons.next : t.seasons.last;
}

/** The year after the last run: the one whose dates are "coming soon". */
export function upcomingYear(t: ProgramTimetable): number | null {
  if (!t.seasons) return null;
  if (t.seasons.next.status === "live") return t.seasons.next.year;
  return t.seasons.last ? t.seasons.last.year + 1 : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Jun – 31 Jul 2026" (CLAUDE.md §4 date style); the year once when both ends share it. */
export function seasonDates(s: Season): string {
  const [y1, m1, d1] = s.start.split("-").map(Number);
  const [y2, m2, d2] = s.end.split("-").map(Number);
  const a = `${d1} ${MONTHS[m1 - 1]}`;
  const b = `${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return y1 === y2 ? `${a} – ${b}` : `${a} ${y1} – ${b}`;
}

/** "Saturday and Sunday", "Monday–Thursday" (a run of three or more consecutive days). */
export function daysInWords(days: readonly Weekday[]): string {
  const idx = days.map((d) => WEEKDAYS.indexOf(d));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (days.length >= 3 && consecutive) return `${WEEKDAY_NAMES[days[0]]}–${WEEKDAY_NAMES[days[days.length - 1]]}`;
  const names = days.map((d) => WEEKDAY_NAMES[d]);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "10–11 AM", "10 AM–12 PM" from "10:00" and "12:00". */
export function wallTimeRange(start: string, end: string): string {
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const mer = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { time: m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, "0")}`, mer };
  };
  const a = fmt(start);
  const b = fmt(end);
  return a.mer === b.mer ? `${a.time}–${b.time} ${b.mer}` : `${a.time} ${a.mer}–${b.time} ${b.mer}`;
}
