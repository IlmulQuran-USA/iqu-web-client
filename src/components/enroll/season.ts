import { programs } from "@/content/pricing";
import { currentSeason, daysInWords, programTimetables, seasonDates, wallTimeRange } from "@/content/program-timetable";

/** The Summer season line on the fee step: "Summer Ilm Camp 2027 · 1 Jun – 31 Jul 2027 · Monday–Thursday, 10 AM–12 PM CT · Live on Zoom". */
export function summerSeasonLine(): { title: string; detail: string } | undefined {
  const t = programTimetables[programs.summer.id];
  const season = currentSeason(t);
  if (!season) return undefined;
  return {
    title: `Summer Ilm Camp ${season.year}`,
    detail: `${seasonDates(season)} · ${daysInWords(t.days)}, ${wallTimeRange(t.start, t.end)} ${t.zoneLabel} · Live on Zoom`,
  };
}
