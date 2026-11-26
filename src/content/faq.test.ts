import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
 * /faq (src/content/faq.ts; report F:/iqu-setup/reports/faq.md). Some content
 * modules import without extensions ("./pricing"), so this test resolves them
 * the way scripts/content-check.mjs does, then loads the modules.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// registerHooks is Node ≥ 22.15; the project's @types/node (20) does not declare it yet.
type Resolve = (specifier: string, context: { parentURL?: string }) => unknown;
type ResolveHook = (specifier: string, context: { parentURL?: string }, nextResolve: Resolve) => unknown;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target: string | null = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:")) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target && !path.extname(target)) {
      for (const ext of [".ts", ".tsx"]) if (existsSync(target + ext)) return nextResolve(pathToFileURL(target + ext).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { faqEntries, faqGroups } = await import("./faq.ts");
const { faq: homeFaq } = await import("./home.ts");
const { catalogFaq } = await import("./catalog.ts");
const { courseFaq, courses } = await import("./courses.ts");
const { faqFor: courseFaqFor } = await import("./course-page.ts");
const { faqFor: programFaqFor } = await import("./program-page.ts");
const { programList } = await import("./courses.ts");
const { matching } = await import("./instructors-page.ts");
const { isPlanned } = await import("./planned-pages.ts");

type QA = { q: string; a: string; points?: readonly string[]; after?: string };
const text = (i: QA) => [i.a, ...(i.points ?? []), i.after ?? ""].join("\n");

test("the owner's seven groups, in order, each question once with a unique anchor", () => {
  assert.deepEqual(
    faqGroups.map((g) => g.title),
    ["Enrolling", "Fees and help with fees", "Classes and schedule", "Teachers", "Payments, billing and refunds", "Weekend and Summer programs", "Giving and Zakat"],
  );
  const ids = faqEntries.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(faqEntries.map((e) => e.q)).size, faqEntries.length);
  for (const id of [...ids, ...faqGroups.map((g) => g.id)]) assert.match(id, /^[a-z0-9-]+$/);
});

test("one source of truth: a question asked anywhere on the site has one answer", () => {
  // Every FAQ the site renders: /faq, Home, the catalog, every course page, both program pages, the directory.
  const all: QA[] = [
    ...faqEntries,
    ...homeFaq.items,
    ...catalogFaq.items,
    ...courseFaq,
    ...courses.flatMap((c) => courseFaqFor(c)),
    // One newsletter state: "When is the next camp?" has one answer per state, and only one state renders.
    ...programList.flatMap((p) => programFaqFor(p, false)),
    ...matching.items,
  ];
  const byQ = new Map<string, Set<string>>();
  for (const item of all) byQ.set(item.q, (byQ.get(item.q) ?? new Set()).add(text(item)));
  // A course with no female teacher answers the gender question for itself (course-page.ts, owner 20 Nov 2026).
  const allowed = new Set(["Can I choose a male or female teacher?"]);
  for (const [q, answers] of byQ) if (!allowed.has(q)) assert.equal(answers.size, 1, `"${q}" has ${answers.size} different answers`);
});

test("the settled facts are said as settled", () => {
  const all = faqEntries.map(text).join("\n");
  assert.match(all, /After the free first month, tuition is charged on the 1st of each month\./);
  assert.match(all, /nothing is charged during your free first month/);
  assert.match(all, /at least 7 days before the next 1st/);
  assert.match(all, /within 48 hours of the charge/);
  assert.match(all, /30, 40, 50 or 60\s+minutes/); // a no-break space before "minutes" (pricing.ts)
  assert.match(all, /\(ET\).*\(CT\).*\(MT\).*\(PT\).*\(AT\)/);
  assert.match(all, /United States or Canada/);
  assert.match(all, /Brothers learn with male teachers\. Sisters, and boys up to age 10, can learn with a female teacher\./);
  assert.match(all, /A certificate is awarded at the end of every course\./);
  assert.match(all, /About half of our students receive help with fees\./);
  assert.match(all, /Listed prices are the full monthly fees\./);
  // Never the corrected or retired claims.
  assert.doesNotMatch(all, /nearly half|study free|billing date|\$30–\$60|every scholarship|separate Zakat|segregat/i);
});

test("every answer ends with a related link that exists, and nothing links to an unbuilt page", () => {
  for (const e of faqEntries) {
    if (e.link) assert.ok(!isPlanned(e.link.href), `${e.id} → ${e.link.href}`);
    for (const [, href] of text(e).matchAll(/\]\((\/[^)]*)\)/g)) assert.ok(!isPlanned(href), `${e.id} → ${href}`);
  }
  assert.ok(faqEntries.filter((e) => e.link).length >= faqEntries.length * 0.6);
});

test("Home's 'All questions' link is back now that /faq exists", () => {
  assert.equal(homeFaq.all?.href, "/faq");
  assert.equal(isPlanned("/faq"), false);
});
