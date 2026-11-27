import { instantAt } from "@/lib/time-zone";

/** The calendar day `now` falls on in `zone`, as [from, to) instants and its YYYY-MM-DD. */
export function dayIn(zone: string, now: Date): { ymd: string; from: Date; to: Date } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { ymd, from: instantAt(zone, "00:00", new Date(`${ymd}T12:00:00Z`)), to: instantAt(zone, "00:00", new Date(`${next}T12:00:00Z`)) };
}

/** The Monday-to-Sunday week `now` falls in, in `zone`. */
export function weekIn(zone: string, now: Date): { from: Date; to: Date } {
  const today = dayIn(zone, now);
  const [y, m, d] = today.ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const back = (dow + 6) % 7;
  const monday = new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
  const nextMonday = new Date(Date.UTC(y, m - 1, d - back + 7)).toISOString().slice(0, 10);
  return { from: instantAt(zone, "00:00", new Date(`${monday}T12:00:00Z`)), to: instantAt(zone, "00:00", new Date(`${nextMonday}T12:00:00Z`)) };
}

/**
 * True in the two weeks before a North American daylight-saving change
 * (spec §7D.5 DualClock banner): the US Eastern offset 14 days from now
 * differs from today's. Returns the date of the change, or null.
 */
export function dstChangeSoon(now: Date): Date | null {
  const offset = (at: Date) => {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  };
  const today = offset(now);
  for (let day = 1; day <= 14; day++) {
    const at = new Date(now.getTime() + day * 86_400_000);
    if (offset(at) !== today) return at;
  }
  return null;
}
