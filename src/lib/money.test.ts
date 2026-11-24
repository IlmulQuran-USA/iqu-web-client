import assert from "node:assert/strict";
import { test } from "node:test";
import { afterFixedOff, afterPercentOff, centsToDecimal, formatUsd, MoneyError, monthlyTuitionCents, percentOf, sumCents, toCents } from "./money.ts";

test("dollars to cents without float drift", () => {
  assert.equal(toCents("40"), 4000);
  assert.equal(toCents("$1,234.56"), 123456);
  assert.equal(toCents("40.5"), 4050);
  assert.equal(toCents(33.6), 3360);
  assert.equal(toCents("0.29"), 29); // 0.29 * 100 in floats is 28.999…
  assert.equal(toCents("19.99"), 1999);
  assert.equal(toCents(0), 0);
});

test("bad amounts are refused, never guessed", () => {
  for (const bad of ["", "abc", "-5", "40.555", "1e3", "$", "4,0.00x"]) assert.throws(() => toCents(bad), MoneyError, bad);
  assert.throws(() => toCents(0.1 + 0.2), MoneyError); // 0.30000000000000004
  assert.throws(() => toCents(Number.NaN), MoneyError);
  assert.throws(() => toCents("2000000"), MoneyError); // above the $1,000,000 guard
});

test("display: whole dollars drop .00; decimals for Stripe-free math", () => {
  assert.equal(formatUsd(4800), "$48");
  assert.equal(formatUsd(3360), "$33.60");
  assert.equal(formatUsd(123456), "$1,234.56");
  assert.equal(formatUsd(5), "$0.05");
  assert.equal(centsToDecimal(3360), "33.60");
  assert.equal(centsToDecimal(7), "0.07");
  assert.throws(() => formatUsd(-1), MoneyError);
  assert.throws(() => formatUsd(1.5), MoneyError);
});

test("monthly tuition = days × 4 × rate (PLUGIN-INVENTORY §2.1)", () => {
  assert.equal(monthlyTuitionCents(1, 5), 2000);
  assert.equal(monthlyTuitionCents(3, 4), 4800);
  assert.equal(monthlyTuitionCents(4, 5), 8000);
  assert.equal(monthlyTuitionCents(7, 4), 11200);
  assert.throws(() => monthlyTuitionCents(0, 5), MoneyError);
  assert.throws(() => monthlyTuitionCents(8, 5), MoneyError);
});

test("help levels: 30 / 45 / 50 / full off, half-up to the cent with integer math", () => {
  assert.equal(afterPercentOff(4800, 30), 3360);
  assert.equal(afterPercentOff(4800, 45), 2640);
  assert.equal(afterPercentOff(4800, 50), 2400);
  assert.equal(afterPercentOff(4800, 100), 0);
  assert.equal(percentOf(1001, 33), 330); // 330.33 → 330
  assert.equal(percentOf(1005, 50), 503); // 502.5 → 503 (half up)
  assert.throws(() => percentOf(4800, 101), MoneyError);
  assert.throws(() => percentOf(4800, 12.5), MoneyError);
});

test("fixed reductions never go below zero", () => {
  assert.equal(afterFixedOff(4800, 2500), 2300);
  assert.equal(afterFixedOff(2000, 2500), 0);
});

test("sums refuse bad members", () => {
  assert.equal(sumCents([4800, 3360, 0]), 8160);
  assert.throws(() => sumCents([4800, -1]), MoneyError);
  assert.throws(() => sumCents([4800, 0.5]), MoneyError);
});
