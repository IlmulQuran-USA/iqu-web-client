import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { dignity, feeScale, howToAsk, scholarshipFinal, scholarshipHeader } from "./scholarship.ts";

/* /scholarship copy (plan approved) and the 26 Nov 2026 claim correction. */

test("help with fees: the four levels, worked out from the published Qaidah fee in cents", () => {
  assert.equal(scholarshipHeader.title, "Help with fees");
  assert.deepEqual(
    feeScale.levels.map((l) => [l.label, l.youPay, l.example]),
    [
      ["30% off", "You pay 70% of the listed fee.", "$33.60 a month"],
      ["45% off", "You pay 55% of the listed fee.", "$26.40 a month"],
      ["50% off", "You pay 50% of the listed fee.", "$24.00 a month"],
      ["Full scholarship", "The scholarship covers the whole fee.", "Nothing"],
    ],
  );
  assert.equal(feeScale.exampleNote, "Example: Noorani Qaidah, 3 days a week, listed at $48 a month.");
});

test("never a discount for everyone; listed prices are the full fees; asking never affects a place", () => {
  assert.match(scholarshipHeader.intro, /^Listed prices are the full monthly fees\. Families who need help can ask/);
  assert.match(feeScale.everyoneNote, /not discounts for everyone/);
  assert.equal(dignity.statement, "No child’s place is ever affected by cost.");
  assert.equal(howToAsk.steps.length, 2);
  assert.equal(scholarshipFinal.button.href, "/enroll?aid=request");
});

test("the corrected claim: 'About half of our students receive help with fees.' and no 'Nearly half … study free' left in src", () => {
  assert.ok(dignity.body.includes("About half of our students receive help with fees."));
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && /Nearly half of our students study free|study at no cost/.test(readFileSync(p, "utf8").replace(/\/\/.*$/gm, ""))) offenders.push(p);
    }
  };
  walk(join(import.meta.dirname, ".."));
  assert.deepEqual(offenders, []);
});
