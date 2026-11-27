import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/*
 * The portal data fences (plan frontend-portal-admin-plan.md §1.1; also
 * eslint.config.mjs no-restricted-imports):
 *   1. Mock data never reaches a public page: outside the portal, the sign-in
 *      code and the data layer itself, nothing imports src/data. (The /enroll
 *      action may write through the interface on the dev preview.)
 *   2. Nothing outside src/data imports an adapter (mock/ or live/).
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
const PORTAL = [/^app\/[apst]\//, /^app\/login\//, /^app\/forgot-password\//, /^app\/actions\/auth\.ts$/, /^app\/actions\/enroll\.ts$/, /^components\/portal\//];
const INSIDE = [/^data\//, /^lib\/auth\//];

function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
}

function resolvesTo(file: string, spec: string): string {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) return rel(path.resolve(path.dirname(file), spec));
  return spec;
}

test("public pages and shared code never import portal data", () => {
  const offenders: string[] = [];
  for (const file of files(SRC)) {
    const r = rel(file);
    if (INSIDE.some((re) => re.test(r)) || PORTAL.some((re) => re.test(r))) continue;
    for (const spec of importsOf(file)) {
      const target = resolvesTo(file, spec);
      if (target === "data" || target.startsWith("data/")) offenders.push(`${r} → ${spec}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("only the data layer imports an adapter", () => {
  const offenders: string[] = [];
  for (const file of files(SRC)) {
    const r = rel(file);
    if (r.startsWith("data/")) continue;
    for (const spec of importsOf(file)) {
      const target = resolvesTo(file, spec);
      if (/^data\/(mock|live)(\/|$)/.test(target)) offenders.push(`${r} → ${spec}`);
    }
  }
  assert.deepEqual(offenders, []);
});
