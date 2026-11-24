/*
 * Money as integer cents (architecture §1.2; PLUGIN-INVENTORY §11 "Money is
 * always recalculated on the server", §7 "money is stored in cents, never as
 * a float"). Every amount the database stores or Stripe receives goes through
 * these helpers. USD only (PRODUCT.md decision 3).
 *
 * Pure and dependency-free: used by the server, the client and the tests.
 */

const MAX_CENTS = 100_000_000; // $1,000,000: far above any IQU amount; guards against unit mistakes

export class MoneyError extends Error {}

function assertCents(c: number): number {
  if (!Number.isSafeInteger(c)) throw new MoneyError(`Not a whole number of cents: ${c}`);
  if (c < 0) throw new MoneyError(`Negative amount: ${c}`);
  if (c > MAX_CENTS) throw new MoneyError(`Amount too large: ${c}`);
  return c;
}

/**
 * "$1,234.56", "40", "40.5", 40, 33.6 → cents. Parsed from the decimal text,
 * never by multiplying a float, so 0.29 is 29 and not 28.999…
 * More than two decimals, negatives and non-numbers are refused.
 */
export function toCents(input: string | number): number {
  const text = typeof input === "number" ? String(input) : input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (typeof input === "number" && !Number.isFinite(input)) throw new MoneyError(`Not a number: ${input}`);
  // Numbers like 1e-7 stringify in exponent form; refuse them rather than guess.
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) throw new MoneyError(`Not a dollar amount: ${String(input)}`);
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  return assertCents(whole * 100 + frac);
}

/** 3360 → "33.60" (for Stripe-free display math and CSV). */
export function centsToDecimal(c: number): string {
  assertCents(c);
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
}

/** 4800 → "$48", 3360 → "$33.60", 123456 → "$1,234.56": whole dollars drop ".00" (site style). */
export function formatUsd(c: number): string {
  assertCents(c);
  const dollars = Math.floor(c / 100).toLocaleString("en-US");
  const rest = c % 100;
  return rest === 0 ? `$${dollars}` : `$${dollars}.${String(rest).padStart(2, "0")}`;
}

/** Sum of cents, refusing any bad member and any overflow past the guard. */
export function sumCents(values: readonly number[]): number {
  return assertCents(values.reduce((total, v) => total + assertCents(v), 0));
}

/**
 * `percent` % of `c`, rounded half up to a whole cent with integer math only
 * (no float drift). 30% of 4800 = 1440; 45% of 4800 = 2160; 33% of 1001 = 330.
 */
export function percentOf(c: number, percent: number): number {
  assertCents(c);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new MoneyError(`Bad percent: ${percent}`);
  return Math.floor((c * percent + 50) / 100);
}

/** What remains after a percentage reduction: the family's monthly amount with help (decision 2). */
export function afterPercentOff(c: number, percent: number): number {
  return c - percentOf(c, percent);
}

/** A fixed reduction never takes an amount below zero (a $25 coupon on $20 leaves $0). */
export function afterFixedOff(c: number, offCents: number): number {
  assertCents(c);
  assertCents(offCents);
  return Math.max(0, c - offCents);
}

/** Monthly tuition in cents: days × 4 weeks × per-class rate in whole dollars (PLUGIN-INVENTORY §2.1). */
export function monthlyTuitionCents(daysPerWeek: number, perClassDollars: number): number {
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) throw new MoneyError(`Bad day count: ${daysPerWeek}`);
  return assertCents(daysPerWeek * 4 * toCents(perClassDollars));
}
