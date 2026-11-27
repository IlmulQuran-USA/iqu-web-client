/*
 * Portal formatting (CLAUDE.md §4): dates as "30 Aug 2026", every time with
 * its zone's year-round label (ET, CT, MT, PT, AT, AKT; "Dhaka" for teachers),
 * money in USD from integer cents. Pure; server and client alike.
 */

export function zoneLabelIn(zone: string, at: Date = new Date()): string {
  if (zone === "Asia/Dhaka") return "Dhaka";
  const generic =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortGeneric" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  // Arizona and Saskatchewan answer "MST" / "CST" all year: still MT and CT.
  return generic.replace(/^([ECMPA])[SD]T$/, "$1T");
}

/** "7:00 PM". */
export function timeIn(at: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(at).replace(/\s/g, " ");
}

/** "7:00 PM CT". */
export function timeWithZone(at: Date, zone: string): string {
  return `${timeIn(at, zone)} ${zoneLabelIn(zone, at)}`;
}

/** "27 Nov 2026". */
export function dateIn(at: Date, zone: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric" }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("day")} ${get("month").slice(0, 3)} ${get("year")}`;
}

/** "Fri 27 Nov". */
export function shortDayIn(at: Date, zone: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short" }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month").slice(0, 3)}`;
}

/** "Friday, 27 Nov 2026". */
export function longDateIn(at: Date, zone: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(at);
  return `${weekday}, ${dateIn(at, zone)}`;
}

/** The Hijri date (Umm al-Qura): "16 Jumada II 1448 AH". */
export function hijriIn(at: Date, zone: string): string {
  const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: zone, day: "numeric", month: "long", year: "numeric" }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} AH`;
}

/** "$48" or "$33.60". */
export function usdCents(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "in 48 min", "in 2 h 5 min". */
export function untilText(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

/** YYYY-MM-DD → "1 Dec 2026". */
export function ymdText(ymd: string): string {
  return dateIn(new Date(`${ymd}T12:00:00Z`), "UTC");
}
