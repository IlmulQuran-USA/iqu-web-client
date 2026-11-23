/*
 * Time-zone helpers for the visitor's own time (CLAUDE.md §4: every displayed
 * time carries its zone label). Client-side only in practice: the server has
 * no idea where the visitor is.
 */

/**
 * The year-round name of the visitor's zone: ET, CT, MT, PT, AT (and the
 * other North American generic names), never the daylight-saving forms.
 * Arizona's year-round "MST" becomes MT. Elsewhere, the UTC offset
 * ("GMT+6"), since a long name like "Bangladesh Time" would crowd the line.
 */
export function zoneLabel(now: Date): string {
  const part = (timeZoneName: "shortGeneric" | "shortOffset") =>
    new Intl.DateTimeFormat("en-US", { timeZoneName }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value;
  const generic = part("shortGeneric") ?? "";
  if (/^[A-Z]{1,4}$/.test(generic)) return generic.replace(/^([ECMPA])[SD]T$/, "$1T");
  return part("shortOffset") ?? "local time";
}

/** Minutes east of UTC for `zone` at the instant `at`. */
function offsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * The instant at which the wall clock in `zone` reads `hhmm` ("10:00") on the
 * calendar day that `day` falls on in that zone. Good for any zone whose
 * offset does not change within the hour in question.
 */
export function instantAt(zone: string, hhmm: string, day: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(day);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const guess = Date.UTC(get("year"), get("month") - 1, get("day"), h, m);
  return new Date(guess - offsetMinutes(zone, new Date(guess)) * 60_000);
}

/** The visitor's calendar day minus the zone's calendar day, at `at`: −1, 0 or 1. */
export function dayShift(zone: string, at: Date): number {
  const ymd = (tz?: string) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
    const get = (type: string) => Number(p.find((x) => x.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"));
  };
  return Math.round((ymd() - ymd(zone)) / 86_400_000);
}

/** "10–11 AM", "10 AM–12 PM", "9:30–10:30 AM" for two instants, in the visitor's zone (or `zone`). */
export function timeRange(from: Date, to: Date, zone?: string): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" })
      .format(d)
      .replace(":00", "")
      .replace(/\s/g, " ");
  const a = fmt(from);
  const b = fmt(to);
  const [aTime, aMer] = a.split(" ");
  const [bTime, bMer] = b.split(" ");
  return aMer === bMer ? `${aTime}–${bTime} ${bMer}` : `${a}–${b}`;
}
