"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { zoneLabel } from "@/lib/time-zone";

/**
 * The visitor's own local time with its zone label, then the invitation to
 * pick any time (spec §7.1 section 2; owner, 20 Nov 2026: class times are
 * fully flexible, there is no teaching-hours window). No second clock here;
 * the Dhaka view belongs to the teacher portal. Every time carries its zone
 * label (CLAUDE.md §4), and the label is the year-round name (CT, never
 * CST/CDT). It never claims that anyone is teaching right now.
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

const INVITE = "Pick any time that suits your family.";


export function LocalTime() {
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

  let text = INVITE;
  if (minute >= 0) {
    const now = new Date(minute * 60_000);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
    text = `It’s ${time} where you are (${zoneLabel(now)}). ${INVITE}`;
  }

  return (
    <p ref={ref} className="flex items-start gap-2 text-body text-ink-body">
      <Clock aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-ink-muted" />
      <span>{text}</span>
    </p>
  );
}
