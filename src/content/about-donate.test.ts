import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { aboutFees, aboutGiving, aboutHeader, aboutLegal, aboutMissionGoal, aboutStory, aboutTeachers, aboutTeaching } from "./about.ts";
import { donateHero, giftUse, giveCard, otherWays, zakat } from "./donate.ts";
import { about, footerColumns, legalLinks, primaryLinks, programs, showLogin, ZEFFY_GIVING_URL } from "./navigation.ts";
import { builtOnly, isPlanned, plannedPages } from "./planned-pages.ts";

/* /about, /donate and the links to pages not built yet (owner, 26 Nov 2026; report F:/iqu-setup/reports/about-donate.md). */

/** Every route the app builds, from src/app (page.tsx files), as regexes: [slug] and [[...x]] match a segment. */
function appRoutes(): RegExp[] {
  const out: RegExp[] = [];
  const walk = (dir: string, route: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, name.startsWith("(") ? route : `${route}/${name}`);
      else if (name === "page.tsx") {
        const pattern = (route || "/")
          .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "(?:/.*)?")
          .replace(/\[[^\]]+\]/g, "[^/]+");
        out.push(new RegExp(`^${pattern}$`));
      }
    }
  };
  walk(join(import.meta.dirname, "..", "app"), "");
  return out;
}

test("no navigation link points at a page that is not built", () => {
  const routes = appRoutes();
  const links = [...about, ...programs, ...footerColumns.flatMap((c) => c.links), ...legalLinks, primaryLinks.instructors, primaryLinks.donate, primaryLinks.enrol];
  for (const link of links) {
    if (/^https?:/.test(link.href)) continue;
    const path = link.href.split(/[?#]/)[0];
    assert.ok(!isPlanned(path), `${link.label} → ${path} is a planned page`);
    assert.ok(routes.some((r) => r.test(path)), `${link.label} → ${path} has no route`);
  }
  // Log in waits for /login.
  assert.equal(showLogin, false);
});

test("the three giving pages that do not exist yet are planned (pending), not linked", () => {
  for (const href of ["/donate/sustainer", "/donate/zakat", "/about/transparency"]) {
    assert.ok(isPlanned(href), href);
    assert.ok(plannedPages.find((p) => p.href === href)?.status === "pending");
  }
  const support = footerColumns.find((c) => c.title === "Support us")!;
  assert.deepEqual(
    support.links.map((l) => l.href),
    ["/donate", ZEFFY_GIVING_URL],
  );
  assert.deepEqual(builtOnly([{ href: "/faq?x=1" }, { href: "/donate#zakat" }]), [{ href: "/donate#zakat" }]);
});

test("planned pages and real routes never overlap (a built page must leave the list)", () => {
  // Static routes only: /programs/[slug] would match /programs/one-on-one, which has no slug (a 404).
  const statics = appRoutes().filter((r) => !r.source.includes("[^/]+") && !r.source.includes("(?:"));
  for (const p of plannedPages) assert.ok(!statics.some((r) => r.test(p.href)), `${p.href} is built: remove it from planned-pages.ts`);
});

test("About: live mission and goal, the current phone, the CP 575 described correctly, the corrected claim", () => {
  const all = JSON.stringify({ aboutHeader, aboutStory, aboutMissionGoal, aboutFees, aboutTeaching, aboutTeachers, aboutLegal, aboutGiving });
  assert.match(aboutHeader.lead, /operated by AL HASANAH FOUNDATION, a 501\(c\)\(3\) nonprofit organization \(EIN: 93-3902300\)/);
  assert.match(aboutMissionGoal[1].text, /^Building a strong and united Ummah/);
  assert.equal(aboutLegal.contact.phone?.display, "+1 (214) 529-3544");
  assert.doesNotMatch(all, /662-1591/);
  const cp575 = aboutLegal.rows.find((r) => r.value.includes("CP 575"))!;
  assert.equal(cp575.label, "EIN assigned");
  assert.doesNotMatch(`${cp575.label} ${cp575.value}`, /determination|recognition/i);
  assert.equal(aboutLegal.determinationLetter.status, "pending");
  assert.match(aboutFees.text, /About half of our students receive help with fees\./);
  assert.doesNotMatch(all, /nearly half|study free|Qur'an/i);
  assert.equal(aboutStory.foundingYear.status, "pending");
});

test("Donate: Zeffy hand-off, 501(c)(3) and EIN by the button, honest framing, no Enroll", () => {
  assert.equal(giveCard.button.href, ZEFFY_GIVING_URL);
  assert.match(giveCard.legal, /501\(c\)\(3\) nonprofit, EIN 93-3902300/);
  const all = JSON.stringify({ donateHero, giveCard, giftUse, zakat, otherWays });
  assert.match(donateHero.lead, /Donations, including Zakat, support our scholarship fund/);
  // Never that donations pay for every scholarship, never a separate Zakat fund (Zeffy records none).
  assert.doesNotMatch(all, /every scholarship|all scholarships|cover(s)? (every|all)|segregat|separate Zakat|Zakat fund/i);
  assert.doesNotMatch(all, /nearly half|study free|\/enroll|free trial/i);
  assert.equal(donateHero.hadith.status, "pending");
});

test("the Donate page renders no enrollment button and one filled button", () => {
  const page = readFileSync(join(import.meta.dirname, "..", "app", "donate", "page.tsx"), "utf8");
  assert.match(page, /<Header giving \/>/);
  assert.equal((page.match(/variant="primary"/g) ?? []).length, 1);
  assert.doesNotMatch(page, /FinalCta|\/enroll/);
});
