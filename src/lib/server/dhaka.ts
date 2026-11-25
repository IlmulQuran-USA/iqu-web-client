/*
 * The site's calendar is Asia/Dhaka (WordPress timezone_string, read 25 Nov
 * 2026). The plugin's wp_date() and wp_timezone() use it for "this month",
 * the ledger month and the 9 PM summary; these helpers do the same from a
 * UTC instant. Intl is used rather than a fixed +06:00, so a future change
 * of the zone's rules cannot shift a month silently.
 */

export const SITE_ZONE = "Asia/Dhaka";

const parts = (d: Date, timeZone: string) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
};

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** wp_date('Y-m-d', $ts): the calendar date in the site zone. */
export function siteYmd(at: Date, timeZone = SITE_ZONE): string {
  const p = parts(at, timeZone);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

/** wp_date('Y-m-01', $ts): the first day of the month in the site zone. */
export function siteMonth(at: Date, timeZone = SITE_ZONE): string {
  return `${siteYmd(at, timeZone).slice(0, 7)}-01`;
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function offsetMs(at: Date, timeZone: string): number {
  const p = parts(at, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant of 00:00 on a calendar date (Y-m-d) in the zone. */
export function zonedMidnight(ymd: string, timeZone = SITE_ZONE): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let at = new Date(guess - offsetMs(new Date(guess), timeZone));
  // One correction step covers a zone whose offset differs between the guess and the answer.
  at = new Date(guess - offsetMs(at, timeZone));
  return at;
}

/** IQU_Database::month_start_utc(): the first moment of the current site month, as a UTC instant. */
export function siteMonthStart(at: Date, timeZone = SITE_ZONE): Date {
  return zonedMidnight(siteMonth(at, timeZone), timeZone);
}

/** Calendar arithmetic on a Y-m-d string (UTC, no zone involved). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 'YYYY-MM-01' one month earlier (DateTimeImmutable::modify('-1 month') on a first of month). */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}
