import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

/*
 * globals.css resets Tailwind's container scale (`--container-*: initial`) so
 * that only the named widths of DESIGN.md exist. A class from the default
 * scale (max-w-2xl, w-md, basis-lg, @lg:) then generates no CSS at all and
 * fails silently: that is how /enroll and its confirmation page lost their
 * width caps. This test turns that silent failure into a red build.
 */

const SRC = join(import.meta.dirname, "..");
const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const defined = new Set([...css.matchAll(/--container-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));

// Tailwind's default container names, plus words that are not widths from the scale.
const DEFAULT_SCALE = new Set(["3xs", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"]);
const KEYWORDS = new Set(["full", "screen", "auto", "min", "max", "fit", "px", "none", "prose", "dvw", "svw", "lvw", "dvh", "svh", "lvh", "lh"]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [p] : [];
  });
}

/** Every width utility from the container scale whose name globals.css does not define. */
export function deadWidthClasses(text: string): string[] {
  const dead: string[] = [];
  for (const m of text.matchAll(/(?<![\w-])-?(max-w|min-w|w|basis)-([a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g)) {
    const name = m[2];
    // Numbers (max-w-90) come from the spacing scale, which is not reset.
    if (/^\d+$/.test(name) || KEYWORDS.has(name) || defined.has(name)) continue;
    if (DEFAULT_SCALE.has(name)) dead.push(m[0]);
  }
  for (const m of text.matchAll(/@(?:min-|max-)?(3xs|2xs|xs|sm|md|lg|xl|[2-7]xl)(?=:)/g)) {
    if (!defined.has(m[1])) dead.push(m[0]);
  }
  return dead;
}

test("the theme defines the named widths of DESIGN.md", () => {
  for (const name of ["content", "page", "measure", "drawer", "form"]) assert.ok(defined.has(name), `--container-${name} is missing`);
  for (const name of DEFAULT_SCALE) assert.ok(!defined.has(name), `--container-${name} brings back the default scale`);
});

test("the guard catches default-scale width classes and lets named ones through", () => {
  assert.deepEqual(deadWidthClasses('<div className="min-w-0 max-w-2xl" />'), ["max-w-2xl"]);
  assert.deepEqual(deadWidthClasses('className="w-md basis-lg @lg:grid-cols-2 sm:max-w-xl"'), ["w-md", "basis-lg", "max-w-xl", "@lg"]);
  assert.deepEqual(deadWidthClasses('className="max-w-measure max-w-form w-full max-w-90 min-w-0 lg:max-w-content"'), []);
});

test("no source file uses a width class that generates no CSS", () => {
  const hits = files(SRC).flatMap((f) => deadWidthClasses(readFileSync(f, "utf8")).map((c) => `${relative(SRC, f)}: ${c}`));
  assert.deepEqual(hits, [], `Use a named width from globals.css (DESIGN.md §4) instead:\n${hits.join("\n")}`);
});
