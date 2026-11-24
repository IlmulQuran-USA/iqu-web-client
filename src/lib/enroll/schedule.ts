/*
 * Schedule rules for /enroll (owner decisions 4 and 5, 24 Nov 2026).
 *
 * - Time zones: Eastern, Central, Mountain, Pacific, Atlantic, Alaska and
 *   Hawaii by their year-round names, plus Other (any IANA zone). The IANA
 *   zone is what the plugin stores (N1); the label is for people.
 * - From/To is an availability window in the family's zone, not the exact
 *   class time: 15-minute steps, end after start, at least one class long.
 * - The plugin also keeps the human string it has always stored in
 *   `time_slot`, e.g. "4:00 PM – 6:00 PM (CT)".
 *
 * Pure functions (Intl only): shared by the browser, the server action and
 * the unit tests.
 */

export type ZoneChoice = { short: string; label: string; iana: string };

/** The seven North American zones, east to west. `iana` is the zone a choice stores. */
export const ZONES: readonly ZoneChoice[] = [
  { short: "AT", label: "Atlantic Time (AT)", iana: "America/Halifax" },
  { short: "ET", label: "Eastern Time (ET)", iana: "America/New_York" },
  { short: "CT", label: "Central Time (CT)", iana: "America/Chicago" },
  { short: "MT", label: "Mountain Time (MT)", iana: "America/Denver" },
  { short: "PT", label: "Pacific Time (PT)", iana: "America/Los_Angeles" },
  { short: "AKT", label: "Alaska Time (AKT)", iana: "America/Anchorage" },
  { short: "HT", label: "Hawaii Time (HT)", iana: "Pacific/Honolulu" },
];

/** Standard (winter) offset in minutes east of UTC for each named zone. */
const STANDARD_OFFSET: Record<string, number> = { AT: -240, ET: -300, CT: -360, MT: -420, PT: -480, AKT: -540, HT: -600 };

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
  return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - at.getTime()) / 60_000);
}

export function isValidZone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The year-round short name of an IANA zone: ET, CT, MT, PT, AT, AKT or HT
 * for North American zones (Arizona's America/Phoenix is MT), otherwise
 * null ("Other"). Decided by the zone's January offset, so daylight saving
 * never changes the answer.
 */
export function namedZone(iana: string): string | null {
  if (!isValidZone(iana)) return null;
  if (!/^America\//.test(iana) && iana !== "Pacific/Honolulu") return null;
  const jan = offsetMinutes(iana, new Date(Date.UTC(2026, 0, 15, 12)));
  return Object.entries(STANDARD_OFFSET).find(([, off]) => off === jan)?.[0] ?? null;
}

/** "CT", or for Other zones the UTC offset now, e.g. "GMT+6". Shown next to every time. */
export function zoneShort(iana: string, now = new Date()): string {
  const named = namedZone(iana);
  if (named) return named;
  if (!isValidZone(iana)) return "";
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: iana, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? iana
  );
}

/** "Central Time (CT)", or "Asia/Dhaka (GMT+6)". */
export function zoneLabel(iana: string): string {
  const named = namedZone(iana);
  if (named) return ZONES.find((z) => z.short === named)?.label ?? named;
  return isValidZone(iana) ? `${iana.replace(/_/g, " ")} (${zoneShort(iana)})` : "";
}

/** The zone the browser reports, or "" when it cannot tell. */
export function detectZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidZone(zone) ? zone : "";
  } catch {
    return "";
  }
}

/** Every IANA zone the runtime knows, for "Other". */
export function allZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ZONES.map((z) => z.iana);
  }
}

/* ── Availability window ─────────────────────────────────────────────── */

const HHMM = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "4:15 PM" from "16:15". */
export function clockLabel(hhmm: string): string {
  const total = minutesOf(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const mer = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${mer}`;
}

/** Every quarter hour of the day, "00:00" to "23:45". */
export const TIME_OPTIONS: readonly { value: string; label: string }[] = Array.from({ length: 96 }, (_, i) => {
  const value = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`;
  return { value, label: clockLabel(value) };
});

export type WindowErrors = { from?: string; to?: string };

/**
 * Checks an availability window. `classLength` is in minutes (0 when not yet
 * chosen: the length rule is then skipped). Messages are the form's own.
 */
export function windowErrors(from: string, to: string, classLength: number): WindowErrors {
  const errors: WindowErrors = {};
  if (!from) errors.from = "Choose the earliest time a class can start.";
  else if (!HHMM.test(from)) errors.from = "Choose a time from the list.";
  if (!to) errors.to = "Choose the latest time a class can end.";
  else if (!HHMM.test(to)) errors.to = "Choose a time from the list.";
  if (errors.from || errors.to) return errors;
  const span = minutesOf(to) - minutesOf(from);
  if (span <= 0) errors.to = "The end of the window must be later than the start.";
  else if (classLength > 0 && span < classLength) {
    errors.to = `The window must be at least ${classLength} minutes, the length of one class.`;
  }
  return errors;
}

/** The plugin's `time_slot` text: "4:00 PM – 6:00 PM (CT)". */
export function timeSlotText(from: string, to: string, iana: string): string {
  return `${clockLabel(from)} – ${clockLabel(to)} (${zoneShort(iana)})`;
}
