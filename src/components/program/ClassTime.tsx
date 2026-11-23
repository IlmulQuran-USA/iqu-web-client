"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { daysInWords, WEEKDAYS, type Weekday } from "@/content/program-timetable";
import { dayShift, instantAt, timeRange, zoneLabel } from "@/lib/time-zone";

/**
 * The program's class time in the visitor's own zone, with its label
 * (CLAUDE.md §4): "That's Saturday and Sunday, 11 AM–12 PM where you are
 * (ET)." The server and first client render show the CT fallback, so there
 * is no hydration mismatch; the local line is filled in once the line nears
 * the viewport, in an idle callback (the same pattern as LocalTime, which
 * keeps Intl's ICU start-up off the load path).
 *
 * `onDate` (yyyy-mm-dd) picks the day used for the conversion, so a summer
 * camp read in November converts with summer's daylight-saving offsets.
 */
export function ClassTime({
  days,
  start,
  end,
  zone,
  zoneName,
  onDate,
}: {
  days: readonly Weekday[];
  start: string;
  end: string;
  zone: string;
  /** "Central Time (CT)". */
  zoneName: string;
  onDate?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelIdle = () => {};
    const run = () => {
      // Noon UTC on the chosen day lands on the same calendar day in every North American zone.
      const day = onDate ? new Date(`${onDate}T12:00:00Z`) : new Date();
      const from = instantAt(zone, start, day);
      const to = instantAt(zone, end, day);
      const label = zoneLabel(from);
      if (label === "CT") {
        setLine("That’s your time too (CT).");
        return;
      }
      const shift = dayShift(zone, from);
      const localDays = days.map((d) => WEEKDAYS[(WEEKDAYS.indexOf(d) + shift + 7) % 7]);
      setLine(`That’s ${daysInWords(localDays)}, ${timeRange(from, to)} where you are (${label}).`);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (typeof window.requestIdleCallback === "function") {
          const id = window.requestIdleCallback(run, { timeout: 1000 });
          cancelIdle = () => window.cancelIdleCallback(id);
        } else {
          const id = window.setTimeout(run, 1);
          cancelIdle = () => window.clearTimeout(id);
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelIdle();
    };
  }, [days, start, end, zone, onDate]);

  return (
    <p ref={ref} className="flex items-start gap-2 text-body text-ink-body">
      <Clock aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-ink-muted" />
      <span>{line ?? `Times are in ${zoneName}.`}</span>
    </p>
  );
}
