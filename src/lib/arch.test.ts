import assert from "node:assert/strict";
import { test } from "node:test";
import { initialsOf } from "./arch.ts";

/*
 * Monogram initials (owner, 21 Nov 2026): the first letters of the first and
 * last name, never of a title. Run with `npm run test:unit` (Node's built-in
 * test runner and TypeScript support; no extra dependency).
 */

test("titles are never initials", () => {
  assert.equal(initialsOf("Hafezah Nuha Rashed"), "NR");
  assert.equal(initialsOf("Mufti Muaj Al-Juhany"), "MA");
  assert.equal(initialsOf("Hafez Muhammad Nurul Ahsan"), "MA");
  assert.equal(initialsOf("Mawlana Nazrul Islam"), "NI");
  assert.equal(initialsOf("Hafiz Abdullah Rahman"), "AR");
  assert.equal(initialsOf("Hafizah Amina Begum"), "AB");
  assert.equal(initialsOf("Shaykh Yusuf Ali"), "YA");
  assert.equal(initialsOf("Dr. Sara Khan"), "SK");
});

test("names without a title", () => {
  assert.equal(initialsOf("Shifa Jalal"), "SJ");
  assert.equal(initialsOf("Afra Humayra"), "AH");
  assert.equal(initialsOf("Maha Rashed"), "MR");
  assert.equal(initialsOf("Najiba Mahzabin Jeba"), "NJ");
  assert.equal(initialsOf("Jawadul Islam Khan Jami"), "JJ");
  // Owner, 22 Nov 2026: the title is removed; the monogram stays AK.
  assert.equal(initialsOf("Alauddin Khilzi"), "AK");
  assert.equal(initialsOf("Sarah H."), "SH");
});

test("edge cases", () => {
  assert.equal(initialsOf("Mufti Sajidullah"), "S");
  assert.equal(initialsOf("  Hafezah   Nuha  Rashed "), "NR");
  assert.equal(initialsOf("Mufti"), "");
});
