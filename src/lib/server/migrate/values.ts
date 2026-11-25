import { toCents } from "../../money.ts";

/*
 * Value conversions from the WordPress snapshot (MySQL strings) to the new
 * schema. Pure functions, no database. Every datetime the plugin writes is UTC
 * (gmdate / current_time('mysql', true)), so "Y-m-d H:i:s" is read as UTC.
 */

export type Cell = string | number | null | undefined;

export const text = (v: Cell): string => (v === null || v === undefined ? "" : String(v)).trim();
export const orNull = (v: Cell): string | null => text(v) || null;
export const int = (v: Cell): number => {
  const n = Number(text(v) || 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
/** A positive WordPress id, or null for 0 / empty. */
export const idOrNull = (v: Cell): number | null => (int(v) > 0 ? int(v) : null);
export const flag = (v: Cell): boolean => text(v) === "1" || text(v).toLowerCase() === "yes" || text(v).toLowerCase() === "true";

/** DECIMAL(8,2) text → integer cents, exactly (toCents parses the decimal text, no float). */
export function cents(v: Cell): number {
  const t = text(v);
  if (t === "") return 0;
  return t.startsWith("-") ? -toCents(t.slice(1)) : toCents(t);
}
export const centsOrNull = (v: Cell): number | null => (text(v) === "" ? null : cents(v));

/** "2026-11-24 19:30:00" (UTC) → Date; empty or the MySQL zero date → null. */
export function utc(v: Cell): Date | null {
  const t = text(v);
  if (!t || t.startsWith("0000-00-00")) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A DATE column as 'YYYY-MM-DD', or null. */
export function ymd(v: Cell): string | null {
  const t = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !t.startsWith("0000") ? t : null;
}

/** "monday, wednesday" → ["monday", "wednesday"] (lower case, trimmed, no blanks). */
export function list(v: Cell): string[] {
  return text(v)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * A phone number as E.164, from the shapes the plugin stored ("+1 214 555 0123",
 * "+1 (214) 555-0123", "+12145550123", "2145550123"). Ten digits with no "+" are a
 * US/Canada number (the form's default country); "00" is the international prefix.
 * Anything else is not guessed: null, and the importer keeps the text in the note.
 */
export function e164(v: Cell): string | null {
  const raw = text(v);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  let out: string;
  if (raw.startsWith("+")) out = `+${digits}`;
  else if (digits.startsWith("00")) out = `+${digits.slice(2)}`;
  else if (digits.length === 10) out = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) out = `+${digits}`;
  else return null;
  return /^\+[1-9]\d{6,14}$/.test(out) ? out : null;
}

const US_STATES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
  "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas",
  "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming",
];
const US_STATE_CODES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn",
  "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va",
  "wa", "wv", "wi", "wy", "dc",
]);

let byName: Map<string, string> | null = null;
function countryNames(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      let name: string | undefined;
      try {
        name = names.of(code);
      } catch {
        continue;
      }
      if (!name || name === code) continue;
      // A retired code (BU for Burma) canonicalises to the current one (MM): skip it.
      try {
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue;
      } catch {
        continue;
      }
      // The first (ISO) code keeps a name: "United Kingdom" is GB, not the reserved UK.
      // "Myanmar (Burma)" is also found as "Myanmar".
      for (const n of [name, name.replace(/\s*\(.*\)$/, "")]) if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), code);
    }
  }
  for (const [alias, code] of Object.entries({ uk: "GB", "great britain": "GB", england: "GB", ksa: "SA", uae: "AE", "bangla desh": "BD" })) byName.set(alias, code);
  return byName;
}

/**
 * A country typed as free text ("United States", "USA", "Dallas tx", "Bangladesh")
 * → its ISO code and the text as typed. Recognised: ISO names and codes, the usual
 * US spellings ("USA", "America", "United State of America"), and a US state or
 * state code ("Texas", "Dallas tx", "California, USA"). Anything else keeps its
 * text with no code (a typo is never guessed).
 */
export function country(v: Cell): { code: string | null; name: string | null } {
  const name = text(v) || null;
  if (!name) return { code: null, name: null };
  const t = name.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ").trim();
  if (/^[a-z]{2}$/.test(t) && countryNames().size && [...countryNames().values()].includes(t.toUpperCase())) return { code: t.toUpperCase(), name };
  const direct = countryNames().get(t);
  if (direct) return { code: direct, name };
  if (/\b(usa|us|u s a|united states?( of america)?|america)\b/.test(t)) return { code: "US", name };
  const words = t.split(/[\s,]+/).filter(Boolean);
  if (US_STATES.some((s) => t === s || t.endsWith(` ${s}`) || t.endsWith(`, ${s}`))) return { code: "US", name };
  if (words.length >= 2 && US_STATE_CODES.has(words[words.length - 1])) return { code: "US", name };
  if (t === "canada" || /\b(ontario|quebec|alberta|british columbia|manitoba)\b/.test(t)) return { code: "CA", name };
  return { code: null, name };
}
