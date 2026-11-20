#!/usr/bin/env node
/**
 * npm run content:check
 *
 * Lists every content item that is not approved for launch, so nothing
 * unapproved ships (owner, 20 Nov 2026):
 *   1. every `status: "draft"` or `status: "pending"` item exported from
 *      src/content, with its file and field path;
 *   2. every "[pending]" placeholder string in those exports;
 *   3. any phrase from docs/spec/COURSE-CONTENT.md §11 "Removed" that has
 *      crept back into src/ (comments are ignored);
 * Exits with 1 while anything above is listed, so it can gate a launch build.
 * Also lists, as warnings that never fail: every `status: "sample"` item under
 * "Sample content to replace" (owner, 21 Nov 2026: shown for admin review,
 * replace or confirm before the public launch), and portraits marked to
 * re-frame.
 *
 * Runs on Node's built-in TypeScript type stripping (Node ≥ 22.18), with a
 * small resolve hook for the "@/" alias and extensionless imports. No extra
 * dependencies.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const CONTENT = path.join(SRC, "content");
/** Modules that define helpers and schemas, not content. */
const SKIP = new Set(["types.ts", "copy.ts"]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;
    if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
    else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:")) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target && !path.extname(target)) {
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(target + ext)) return nextResolve(pathToFileURL(target + ext).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts")) return nextLoad(url, { ...context, format: "module-typescript" });
    return nextLoad(url, context);
  },
});

const STATUSES = new Set(["live", "draft", "pending", "sample"]);
const PENDING_MARK = "[pending]";

/** A readable key for an array element: its id, title or question, else its index. */
function elementKey(value, index) {
  if (value && typeof value === "object") {
    for (const k of ["id", "title", "q", "label"]) {
      if (typeof value[k] === "string") return value[k].length > 40 ? `${value[k].slice(0, 39)}…` : value[k];
    }
  }
  return String(index);
}

function preview(item) {
  const raw =
    typeof item.text === "string"
      ? item.text
      : typeof item.quote === "string"
        ? `${item.name ? `${item.name}: ` : ""}${item.quote}`
      : Array.isArray(item.items) && item.items.length
        ? item.items.join(" · ")
        : Array.isArray(item.steps)
          ? item.steps.map((s) => s.title).join(" · ")
          : typeof item.a === "string"
            ? item.a
            : typeof item.body === "string"
              ? item.body
              : typeof item.label === "string"
                ? item.label
                : "";
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > 72 ? `${flat.slice(0, 71)}…` : flat;
}

/** Walks an export and collects draft and pending items by field path. */
function walk(value, at, found, ancestors = new Set()) {
  if (typeof value === "string") {
    if (value === PENDING_MARK) found.push({ status: "pending", path: at, preview: "" });
    return;
  }
  if (!value || typeof value !== "object" || typeof value === "function" || ancestors.has(value)) return;
  ancestors.add(value);
  if (STATUSES.has(value.status) && value.status !== "live") {
    found.push({ status: value.status, path: at, preview: preview(value) });
    // A sample block is listed once, as a whole: its contents (which may hold
    // real records, e.g. instructors) are not walked again.
    if (value.status === "sample") {
      ancestors.delete(value);
      return;
    }
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${at}[${elementKey(v, i)}]`, found, ancestors));
  } else {
    for (const [k, v] of Object.entries(value)) if (k !== "status") walk(v, `${at}.${k}`, found, ancestors);
  }
  ancestors.delete(value);
}

/* ── 1–2 · Draft and pending content ─────────────────────────────────────── */

const files = readdirSync(CONTENT)
  .filter((f) => f.endsWith(".ts") && !SKIP.has(f))
  .sort();
const report = [];
for (const file of files) {
  const mod = await import(pathToFileURL(path.join(CONTENT, file)).href);
  const found = [];
  for (const [name, value] of Object.entries(mod)) {
    // The placeholder constant itself (site.ts PENDING) is not an item.
    if (value !== PENDING_MARK) walk(value, name, found);
  }
  if (found.length) report.push({ file: `src/content/${file}`, found });
}

/* ── 4 · Portraits to re-frame ───────────────────────────────────────────── */

const { instructors } = await import(pathToFileURL(path.join(CONTENT, "instructors.ts")).href);
const toReframe = instructors.filter((p) => p.photo?.reframe);

/* ── 3 · Removed phrases (COURSE-CONTENT.md §11) ─────────────────────────── */

const REMOVED = [
  [/free lifetime support/i, "“Free lifetime support”"],
  [/\bretake\s*:/i, "“Retake: yes”"],
  [/99\s*%\s*student satisfaction/i, "“99% student satisfaction”"],
  [/included in this challenge/i, "“What's included in this challenge?”"],
  [/duration\s*2\s*weeks|2 weeks\s*\/\s*10 lessons/i, "“Duration 2 weeks / 10 lessons”"],
  [/\$30\s*[–-]\s*\$60/, "“fee $30–$60”"],
  [/no fees, no hassle/i, "“no fees, no hassle”"],
  [/any device/i, "“any device — phone or computer”"],
  [/lorem ipsum/i, "lorem ipsum"],
  [/\b\d+\s+reviews\b/i, "a review count"],
  [/\b\d(\.\d)?\s*(out of 5|★|stars?)\b/i, "a star rating"],
];

/** Source lines with comments removed (line, block and JSX comments). */
function codeLines(text) {
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  return lines.map((line) => {
    let out = "";
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf("*/", i);
        if (end === -1) return out;
        inBlock = false;
        i = end + 2;
        continue;
      }
      const start = line.indexOf("/*", i);
      const lineComment = line.search(/(^|[^:"'`])\/\//);
      if (lineComment !== -1 && lineComment >= i && (start === -1 || lineComment < start)) {
        return out + line.slice(i, lineComment + (line[lineComment] === "/" ? 0 : 1));
      }
      if (start === -1) return out + line.slice(i);
      out += line.slice(i, start);
      inBlock = true;
      i = start + 2;
    }
    return out;
  });
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "dev" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const removedHits = [];
for (const file of sourceFiles(SRC)) {
  codeLines(readFileSync(file, "utf8")).forEach((line, i) => {
    for (const [pattern, label] of REMOVED) {
      if (pattern.test(line)) removedHits.push({ file: path.relative(ROOT, file).replaceAll("\\", "/"), line: i + 1, label });
    }
  });
}

/* ── Output ──────────────────────────────────────────────────────────────── */

let drafts = 0;
let pendings = 0;
const samples = [];
for (const { file, found } of report) {
  const blocking = found.filter((f) => f.status !== "sample");
  for (const f of found) if (f.status === "sample") samples.push({ file, ...f });
  if (blocking.length === 0) continue;
  console.log(`\n${file}`);
  const width = Math.max(...blocking.map((f) => f.path.length));
  for (const f of blocking) {
    if (f.status === "draft") drafts++;
    else pendings++;
    console.log(`  ${f.status.padEnd(8)} ${f.path.padEnd(width)}  ${f.preview}`);
  }
}
// Sample content (owner, 21 Nov 2026): shown for admin review; a warning, never a failure.
if (samples.length) {
  console.log("\nSample content to replace (shown for admin review; replace or confirm before the public launch)");
  const width = Math.max(...samples.map((s) => `${s.file}  ${s.path}`.length));
  for (const s of samples) console.log(`  warning  ${`${s.file}  ${s.path}`.padEnd(width)}  ${s.preview}`);
}
if (removedHits.length) {
  console.log("\nRemoved content (COURSE-CONTENT.md §11) found in src/");
  for (const h of removedHits) console.log(`  ${h.file}:${h.line}  ${h.label}`);
}

if (toReframe.length) {
  console.log("\nPortraits to re-frame (src/content/instructors.ts; does not block launch)");
  for (const p of toReframe) console.log(`  ${p.id}  ${p.photo.src}  ${p.photo.width} × ${p.photo.height}`);
}

// Sample items are warnings only: they never count towards the exit code.
const total = drafts + pendings + removedHits.length;
console.log(
  total
    ? `\n${drafts} draft · ${pendings} pending · ${removedHits.length} removed-content hit${removedHits.length === 1 ? "" : "s"} · ${samples.length} sample (warning). Not ready for launch.`
    : `\nAll content is live. Nothing draft, pending or removed.${samples.length ? ` ${samples.length} sample item(s) to replace (warning).` : ""}`,
);
process.exitCode = total ? 1 : 0;
