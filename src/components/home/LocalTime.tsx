"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * The visitor's own local time and whether it falls inside teaching hours
 * (spec §7.1 section 2, owner decision 19 Nov 2026: no second clock here; the
 * Dhaka view belongs to the teacher portal). Every time carries its zone
 * label (CLAUDE.md §4). It never claims that anyone is teaching right now.
 *
 * The server and the first client render show the static fallback, so there
 * is no hydration mismatch; the browser then fills in the live line and
 * updates it each minute. Not announced to screen readers as it ticks.
 */

const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => -1;

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
  const minute = useSyncExternalStore(subscribe, currentMinute, serverMinute);

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
    <p className="flex items-start gap-2 text-body text-ink-body">
      <Clock aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-ink-muted" />
      <span>{text}</span>
    </p>
  );
}
