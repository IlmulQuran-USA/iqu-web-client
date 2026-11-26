import { aid } from "./aid.ts";
import { ZEFFY_GIVING_URL } from "./navigation.ts";
import { site } from "./site.ts";

/*
 * /donate (spec §7.10; plan F:/iqu-setup/reports/giving-about-shape-plan.md
 * §1.2 option A and §1.3; owner, 26 Nov 2026).
 *
 * Our own page, then one link out to the live Zeffy form: the same URL as the
 * live WordPress Donate page (read 26 Nov 2026). No amount widget: a choice
 * made here could not be carried into Zeffy, which defaults to one-time.
 * Donate is the page's one filled button; there is no enrollment button on a
 * giving page (the header drops it too).
 *
 * Honest framing (owner, 26 Nov 2026):
 *   - donations, including Zakat, SUPPORT the scholarship fund; never that
 *     they cover every scholarship (all giving since 2019 is about one month
 *     of fee reductions; plan Part 2);
 *   - no separate Zakat fund is claimed: Zeffy records no fund or Zakat
 *     designation (all 69 payments, plan Part 2).
 * Every sentence is sourced below; nothing is invented.
 */

export const donateMeta = {
  title: "Donate",
  description:
    "Support Quranic education. Donations, including Zakat, support the scholarship fund of Ilm-Ul-Quran USA, a 501(c)(3) nonprofit (EIN 93-3902300).",
};

export const donateHero = {
  // Live Donate page H1 ("Support Quranic Education, Empower the Ummah"), in sentence case (DESIGN.md §3).
  title: "Support Quranic education, empower the Ummah",
  // PRODUCT.md ("Donations, including Zakat, go to the scholarship fund") and the Tuition Policy (live).
  lead: "Donations, including Zakat, support our scholarship fund, which helps families who cannot pay the full monthly fee. No child's place is ever affected by cost.",
  /** Spec §7.10's hadith anchor: its citation and Arabic need the teaching team (plan Q11). Not rendered until then. */
  hadith: { status: "pending", label: "Donate hero hadith (Arabic, English, citation)" },
};

/** The hand-off card: what the donor will find on Zeffy (all live on the Zeffy form, read 25 Nov 2026). */
export const giveCard = {
  title: "How giving works",
  points: [
    "You give on Zeffy, our giving partner. Choose a one-time or monthly gift: $25, $50, $75, $100 or another amount.",
    "Zeffy emails your tax receipt.",
    // Zeffy's own line on the form: "We fundraise with Zeffy to ensure 100% of your donation goes to our work!"
    "We fundraise with Zeffy so that 100% of your donation goes to our work.",
  ],
  button: { label: "Donate on Zeffy", href: ZEFFY_GIVING_URL },
  /** Said before the hand-off, never a modal (plan §1.3 states). */
  handoff: "Opens Zeffy in a new tab.",
  // Next to the button (spec §7.10; owner, 26 Nov 2026). Wording: the live Terms §4, which already promises
  // "may be tax-deductible as allowed by law"; no stronger tax claim (plan Q8).
  legal: `Donations are received by ${site.legalName} (${site.name}), a ${site.taxStatus}, EIN ${site.ein}, and may be tax-deductible as allowed by law.`,
};

export const giftUse = {
  heading: "Where your gift goes",
  body: [
    // ./aid.ts: the corrected claim, never "nearly half study free".
    aid.help.text,
    "Donations, including Zakat, support this scholarship fund.",
  ],
  link: { label: "How families ask for help", href: "/scholarship" },
};

export const zakat = {
  heading: "Zakat",
  // No separate Zakat fund is claimed: Zeffy records none (plan Part 2). Families who receive help from
  // Zakat confirm their eligibility in writing (the live enrollment declaration, src/lib/server/enroll/coupon.ts).
  body: [
    "You can give your Zakat through the same Zeffy form. It goes to our scholarship fund, and families who receive help from Zakat confirm in writing that they are eligible.",
    `For any question about giving Zakat, email [${site.email}](mailto:${site.email}).`,
  ],
};

export const otherWays = {
  heading: "Monthly and other ways to give",
  body: [
    // Live on the Zeffy form: One-time (default) or Monthly.
    "To give every month, choose Monthly on the Zeffy form.",
    // Plan §1.3 section 6: only this until the owner confirms other methods (Q9).
    `For other ways to give, email [${site.email}](mailto:${site.email}).`,
  ],
};

/**
 * Spec §7.10 sections not built yet (plan Q2, Q3, Q6, Q9): the sustainer tiers, the Zakat page and the
 * transparency page (src/content/planned-pages.ts), and the donor FAQ answers. Listed by content:check.
 */
export const donatePending = [
  { status: "pending", label: "Donor FAQ (tax deductibility in Canada, cancelling monthly gifts, Zakat handling)", items: [] as string[] },
  { status: "pending", label: "Other ways to give (employer match, stock or DAF, cheque, bank transfer)", items: [] as string[] },
] as const;
