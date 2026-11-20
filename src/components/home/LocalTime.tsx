"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The visitor's own local time and whether it falls inside teaching hours
 * (spec §7.1 section 2, owner decision 19 Nov 2026: no second clock here; the
 * Dhaka view belongs to the teacher portal). Every time carries its zone
 * label (CLAUDE.md §4). It never claims that anyone is teaching right now.
 *
 * The server and the first client render show the static fallback, so there
 * is no hydration mismatch. The live line is filled in only once the line is
 * near the viewport, in an idle callback, and then updated each minute. Not
 * announced to screen readers as it ticks.
 *
 * Performance (CLAUDE.md §4, TBT/INP): a page's first Intl.DateTimeFormat
 * initialises ICU and costs ~40 ms on a slow laptop (~160 ms at Lighthouse's
 * 4× mobile CPU). Rendering the live line during hydration put that inside
 * the page's longest task; deferring it keeps it off the load path entirely.
 */

/** Start the live line this far before the section scrolls into view. */
const ROOT_MARGIN = "400px 0px";

export function LocalTime({
  fromHour,
  toHour,
  hoursLabel,
  zones,
}: {
  fromHour: number;
  toHour: number;
  hoursLabel: string;
  zones: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [minute, setMinute] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelIdle = () => {};
    let timer = 0;
    const tick = () => setMinute(Math.floor(Date.now() / 60_000));
    const start = () => {
      tick();
      timer = window.setInterval(tick, 30_000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        // Safari before 18 has no requestIdleCallback.
        if (typeof window.requestIdleCallback === "function") {
          const id = window.requestIdleCallback(start, { timeout: 1000 });
          cancelIdle = () => window.cancelIdleCallback(id);
        } else {
          const id = window.setTimeout(start, 1);
          cancelIdle = () => window.clearTimeout(id);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelIdle();
      window.clearInterval(timer);
    };
  }, []);

  let text = `Class times are set in ${zones}.`;
  if (minute >= 0) {
    const now = new Date(minute * 60_000);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
    const zone =
      new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName")
        ?.value ?? "local time";
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Mainland US and Canadian zones: UTC−4 to UTC−8 in an America/* zone.
    const offset = -now.getTimezoneOffset() / 60;
    const northAmerica = tz.startsWith("America/") && offset <= -4 && offset >= -8;
    const hour = now.getHours() + now.getMinutes() / 60;
    const inside = hour >= fromHour && hour < toHour;

    text = northAmerica
      ? inside
        ? `It’s ${time} where you are (${zone}), inside our teaching hours.`
        : `It’s ${time} where you are (${zone}), outside our teaching hours of ${hoursLabel}.`
      : `It’s ${time} where you are (${zone}). Class times are set in ${zones}.`;
  }

  return (
    <p ref={ref} className="flex items-start gap-2 text-body text-ink-body">
      <Clock aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-ink-muted" />
      <span>{text}</span>
    </p>
  );
}
