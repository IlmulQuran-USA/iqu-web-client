import assert from "node:assert/strict";
import { test } from "node:test";
import { legalRedirects, livePolicyPaths } from "./legacy-paths.ts";
import { accessibilityStatement, privacyPolicy, refundPolicy, termsAndConditions, type LegalDoc, type LegalItem } from "./legal.ts";
import { legalLinks } from "./navigation.ts";

/* /legal/* content (src/content/legal.ts; report F:/iqu-setup/reports/legal-pages.md). */

const legalDocs = [privacyPolicy, termsAndConditions, refundPolicy, accessibilityStatement];

/** Every block and list item as shown on the page (settled removals left out). */
function shownTexts(doc: LegalDoc): string[] {
  const out: string[] = [];
  for (const block of [...doc.intro, ...doc.sections.flatMap((s) => s.blocks)]) {
    if (block.type === "p") {
      if (!(block.change?.status === "live" && block.change.kind === "remove")) out.push(block.text);
    } else if (block.type === "list") {
      for (const item of block.items) if (!(item.change?.status === "live" && item.change.kind === "remove")) out.push(item.text);
    } else out.push(...block.lines);
  }
  return out;
}

function allChanges(doc: LegalDoc) {
  return doc.sections.flatMap((s) => [
    ...(s.titleChange ? [s.titleChange] : []),
    ...s.blocks.flatMap((b) => (b.type === "p" && b.change ? [b.change] : b.type === "list" ? b.items.flatMap((i: LegalItem) => (i.change ? [i.change] : [])) : [])),
  ]);
}

test("every footer legal link has a page, and every page is linked from the footer", () => {
  assert.deepEqual(
    legalLinks.map((l) => l.href).sort(),
    legalDocs.map((d) => d.path).sort(),
  );
});

test("section ids are unique within each page, and internal links point at existing pages", () => {
  const paths = new Set<string>([...legalDocs.map((d) => d.path), "/contact"]);
  for (const doc of legalDocs) {
    const ids = doc.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${doc.slug}: duplicate section id`);
    for (const text of shownTexts(doc)) {
      for (const [, href] of text.matchAll(/\]\((\/[^)]*)\)/g)) assert.ok(paths.has(href), `${doc.slug}: link to ${href}`);
    }
  }
});

test("every change records the live wording (unless an addition) and a reason", () => {
  for (const doc of legalDocs) {
    for (const c of allChanges(doc)) {
      assert.ok(c.reason.length > 20, `${doc.slug}: ${c.label} needs a reason`);
      assert.equal(c.old === null, c.kind === "add", `${doc.slug}: ${c.label} old wording`);
    }
  }
});

test("Tuition & refunds follow the settled rules: the 1st, the free month, 7 days, 48 hours, one earlier month, waiver", () => {
  const text = shownTexts(refundPolicy).join("\n");
  assert.match(text, /After the free first month, tuition is charged on the 1st of each month\./);
  assert.match(text, /New students study their first month free\./);
  assert.match(text, /at least 7 days before the next 1st/);
  assert.match(text, /within 48 hours of the charge/);
  assert.match(text, /that month and the new month are charged together on that day, in one payment/);
  assert.match(text, /never charge more than one earlier month/);
  assert.match(text, /waive an unpaid earlier month/);
  // K1 retires the per-family billing date.
  assert.doesNotMatch(text, /billing date/);
  // Settled corrections, not proposals: nothing on this page waits for approval.
  assert.ok(allChanges(refundPolicy).every((c) => c.status === "live"));
});

test("Privacy keeps every live commitment; its updates are proposed (draft) changes", () => {
  const text = shownTexts(privacyPolicy).join("\n");
  for (const commitment of [
    "We do not sell personal information.",
    "We reply within 30 days.",
    "for up to 7 years afterwards",
    "We never send a child's name, a student's date of birth or age, notes or payment details.",
    "A parent or guardian can ask to see, correct or delete their child's information at any time.",
    "email families about important changes",
    "Refuse non-essential cookies through the cookie banner.",
  ]) {
    assert.ok(text.includes(commitment), `missing: ${commitment}`);
  }
  assert.doesNotMatch(text, /we save the IP address/);
  const changes = allChanges(privacyPolicy);
  assert.ok(changes.length > 0 && changes.every((c) => c.status === "draft"));
});

test("Terms is the live text, unchanged apart from its links", () => {
  assert.equal(allChanges(termsAndConditions).length, 0);
  assert.equal(termsAndConditions.updated, "6 Oct 2026");
});

test("Accessibility is a draft that claims no conformance and says how to report a problem", () => {
  assert.equal(accessibilityStatement.status, "draft");
  const text = shownTexts(accessibilityStatement).join("\n");
  assert.doesNotMatch(text, /\b(compliant|conforms?|conformance|certified|fully accessible)\b/i);
  assert.match(text, /not a statement that every page meets it/);
  assert.match(text, /mailto:info@ilmulquranus\.org/);
  assert.match(text, /\/contact/);
});

test("each live WordPress policy URL has an exact 301 to its /legal page", () => {
  assert.deepEqual(legalRedirects(), [
    { source: "/privacy-policy", destination: "/legal/privacy", statusCode: 301 },
    { source: "/terms-and-conditions", destination: "/legal/terms", statusCode: 301 },
    { source: "/tuition-refund-policy", destination: "/legal/refund", statusCode: 301 },
  ]);
  const paths = new Set<string>(legalDocs.map((d) => d.path));
  for (const to of Object.values(livePolicyPaths)) assert.ok(paths.has(to));
  for (const doc of legalDocs) if (doc.source) assert.equal(livePolicyPaths[new URL(doc.source.url).pathname.replace(/\/$/, "")], doc.path);
});
