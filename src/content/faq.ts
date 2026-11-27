import { aid } from "./aid";
import { courseFaq, courseRules, teacherMatching } from "./courses";
import { donateHero, giveCard, otherWays, zakat } from "./donate";
import { faq as homeFaq } from "./home";
import { refundPolicy, termsAndConditions, type LegalDoc } from "./legal";
import { summerFaq, weekendFaq } from "./program-page";
import { programs, sessionLengths } from "./pricing";
import { howToAsk } from "./scholarship";

/*
 * /faq (spec §7.14; owner, 26 Nov 2026). Groups in the owner's order.
 *
 * ONE SOURCE OF TRUTH: an answer is never written twice. A question that also
 * appears on Home, a course page or a program page reuses that exact object
 * (homeFaq.items, courseFaq, weekendFaq, summerFaq); an answer about fees,
 * billing or giving reuses the exact string of the page that owns the rule
 * (the Tuition, Payment & Refund Policy, the Terms, /donate, /scholarship).
 * src/content/faq.test.ts fails if one question ever has two answers.
 *
 * New answers are only live text (quoted, with the WordPress source) or a
 * sentence built from settled rules (PRODUCT.md, pricing.ts). The owner
 * approved every answer as final on 27 Nov 2026; a new answer starts as draft
 * again. Nothing unsourced: "What happens after I enroll?" stays pending
 * (program-page.ts afterEnrolFaq) and is not shown.
 *
 * Inline text may hold [label](href) links (rendered by InlineText; plain in
 * the FAQPage JSON-LD).
 */

export type FaqLink = { label: string; href: string };

export type FaqEntry = {
  /** The anchor: /faq#<id>. */
  id: string;
  q: string;
  a: string;
  points?: readonly string[];
  after?: string;
  /** The related link each answer ends with (spec §7.14). */
  link?: FaqLink;
  status: "live" | "draft";
};

export type FaqGroup = { id: string; title: string; items: FaqEntry[] };

/** Plain text of a legal block: **bold** and [label](href) reduced to their words. */
const plain = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

/** A list item or paragraph of a legal page, by section id and position: the same words as the policy. */
function policy(doc: LegalDoc, sectionId: string, index: number): string {
  const section = doc.sections.find((s) => s.id === sectionId);
  const texts = section?.blocks.flatMap((b) => (b.type === "list" ? b.items.filter((i) => !(i.change?.status === "live" && i.change.kind === "remove")).map((i) => i.text) : b.type === "p" ? [b.text] : []));
  const text = texts?.[index];
  if (!text) throw new Error(`${doc.slug}#${sectionId}[${index}] is gone: update src/content/faq.ts`);
  return plain(text);
}

/** An existing question, by its exact wording, from a list the site already shows. */
function reuse<T extends { q: string; a: string; status?: string }>(list: readonly T[], q: string, id: string, link?: FaqLink): FaqEntry {
  const item = list.find((i) => i.q === q);
  if (!item) throw new Error(`"${q}" is gone: update src/content/faq.ts`);
  const extra = item as T & { points?: readonly string[]; after?: string };
  return {
    id,
    q: item.q,
    a: item.a,
    ...(extra.points ? { points: extra.points } : {}),
    ...(extra.after ? { after: extra.after } : {}),
    ...(link ? { link } : {}),
    status: item.status === "live" ? "live" : "draft",
  };
}

const enroll: FaqLink = { label: "Enroll", href: "/enroll" };
const refund: FaqLink = { label: "Tuition, Payment & Refund Policy", href: "/legal/refund" };
const help: FaqLink = { label: "Help with fees", href: "/scholarship" };
const give: FaqLink = { label: "Donate", href: "/donate" };

const K1 = policy(refundPolicy, "billing-on-the-1st", 0).split(". ")[0] + "."; // "After the free first month, tuition is charged on the 1st of each month."

export const faqMeta = {
  title: "Frequently asked questions",
  description:
    "Answers about enrolling, fees and help with fees, class times, teachers, billing and refunds, the Weekend and Summer programs, and giving to Ilm-Ul-Quran USA.",
} as const;

export const faqHeader = {
  title: "Frequently asked questions",
  lead: "Answers to the questions families ask us most. If yours isn’t here, ask us directly.",
} as const;

export const faqGroups: FaqGroup[] = [
  {
    id: "enrolling",
    title: "Enrolling",
    items: [
      {
        id: "who-can-enroll",
        q: "Who can enroll in Ilm-Ul-Quran USA programs?",
        // Live Home FAQ (WP page 13), verbatim.
        a: "Our programs are open to children, teenagers, adults and working professionals across the USA and Canada. We offer courses for all levels—from beginners to advanced learners.",
        link: { label: "All courses", href: "/courses" },
        status: "live",
      },
      {
        id: "outside-us-canada",
        q: "Do you teach families outside the United States and Canada?",
        // Live Privacy Policy: "new students live in the United States or Canada, where our classes are offered" (PLUGIN-INVENTORY §1).
        a: "No. Our classes are offered to families who live in the United States or Canada.",
        status: "live",
      },
      reuse(homeFaq.items, "What is the youngest age you teach?", "youngest-age", { label: "All courses", href: "/courses" }),
      {
        id: "how-to-enroll",
        q: "How do I enroll?",
        // PRODUCT.md: /enroll has five steps (Student · Course · Schedule · Fees · Review); Weekend and Summer use fewer;
        // progress saves on the family's device (decision 10).
        a: "Fill in our enrollment form. For monthly classes it has five short steps: the student, the course, the schedule, the fee and a final review; the Weekend and Summer programs need fewer. Your answers are saved on this device as you go.",
        link: enroll,
        status: "live",
      },
      reuse(homeFaq.items, "Is the first month really free?", "first-month-free", enroll),
      {
        id: "online",
        q: "Are the classes online or in-person?",
        // Live Home FAQ (WP page 13), verbatim.
        a: "All of our classes are conducted online via Zoom, allowing students to join from anywhere with a flexible and convenient schedule.",
        status: "live",
      },
      reuse(homeFaq.items, "What do we need for classes?", "what-we-need"),
    ],
  },
  {
    id: "fees",
    title: "Fees and help with fees",
    items: [
      reuse(homeFaq.items, "How much do classes cost?", "cost", { label: "All courses and fees", href: "/courses" }),
      {
        id: "help-with-fees",
        q: "Can we get help with the fee?",
        // ./aid.ts: "Listed prices are the full monthly fees…" + "About half of our students receive help with fees."
        a: aid.help.text,
        link: help,
        status: "live",
      },
      {
        id: "how-to-ask",
        q: "How do we ask for help with the fee?",
        // /scholarship "How to ask" (src/content/scholarship.ts), both steps in order.
        a: howToAsk.steps.map((s) => s.body).join(" "),
        link: help,
        status: "live",
      },
      {
        id: "sibling-discount",
        q: "Is there a discount for brothers and sisters?",
        // PRODUCT.md decision 2: "No sibling discount. Every child pays the full fee."
        a: "No. Every child pays the full fee for their course. Families who need help can ask for a reduced fee or a full scholarship.",
        link: help,
        status: "live",
      },
    ],
  },
  {
    id: "classes",
    title: "Classes and schedule",
    items: [
      reuse(homeFaq.items, "What times are classes?", "times", enroll),
      {
        id: "time-zones",
        q: "Which time zone are class times in?",
        // PRODUCT.md "Time zones": every time carries its zone label, ET, CT, MT, PT and AT; the family picks its zone in /enroll.
        a: "Yours. When you enroll you choose your time zone, and every class time we show carries its zone: Eastern (ET), Central (CT), Mountain (MT), Pacific (PT) or Atlantic (AT).",
        status: "live",
      },
      {
        id: "class-length",
        q: "How long is each class?",
        // pricing.ts sessionLengths (the live plugin's list); Home cost answer: "class length does not change the price".
        a: `Classes are ${sessionLengths} long. You choose the length when you enroll, and it does not change the price.`,
        status: "live",
      },
      reuse(courseFaq, "One-on-one or group?", "one-on-one-or-group"),
      {
        id: "languages",
        q: "Which languages are classes taught in?",
        // courses.ts courseRules.languages (live). The Weekend and Summer programs: English (program pages; below).
        a: courseRules.languages.text,
        status: "live",
      },
      reuse(courseFaq, "Is there a certificate?", "certificate"),
      {
        id: "reschedule",
        q: "Can we reschedule a class?",
        // Live Terms and Conditions §5 (WP page 443), verbatim.
        a: policy(termsAndConditions, "attendance-policy", 2),
        link: { label: "Terms and Conditions", href: "/legal/terms" },
        status: "live",
      },
      reuse(courseFaq, "What if a class is cancelled?", "class-cancelled", refund),
      reuse(courseFaq, "Can we change days or the course later?", "change-later"),
    ],
  },
  {
    id: "teachers",
    title: "Teachers",
    items: [
      reuse(courseFaq, "Can I choose a male or female teacher?", "male-or-female-teacher", { label: "Our teachers", href: "/instructors" }),
      {
        id: "matching",
        q: "How do you choose a teacher for my child?",
        // courses.ts teacherMatching (CONTENT-ADDENDUM §3.4 with the owner's teacher rule).
        a: teacherMatching.text,
        status: "live",
      },
      {
        id: "who-teaches",
        q: "Who are your teachers?",
        // site.ts mission (live): "Live Quran and Islamic classes taught by qualified Huffaz, Ulama and Mufti…".
        a: "Qualified Huffaz, Ulama and Mufti. Each teacher has a profile with the courses they teach and the languages they speak.",
        link: { label: "Meet our teachers", href: "/instructors" },
        status: "live",
      },
    ],
  },
  {
    id: "billing",
    title: "Payments, billing and refunds",
    items: [
      {
        id: "when-charged",
        q: "When is tuition charged?",
        // Tuition, Payment & Refund Policy §3 (K1) and §1.
        a: `${K1} ${policy(refundPolicy, "tuition", 0)}`,
        link: refund,
        status: "live",
      },
      {
        id: "how-to-pay",
        q: "How do we pay?",
        a: policy(refundPolicy, "how-payments-are-taken", 0),
        after: policy(refundPolicy, "how-payments-are-taken", 4),
        link: refund,
        status: "live",
      },
      {
        id: "payment-fails",
        q: "What if a payment does not go through?",
        a: policy(refundPolicy, "if-a-payment-does-not-go-through", 0),
        points: [
          policy(refundPolicy, "if-a-payment-does-not-go-through", 1),
          policy(refundPolicy, "if-a-payment-does-not-go-through", 3),
          policy(refundPolicy, "if-a-payment-does-not-go-through", 5),
        ],
        link: refund,
        status: "live",
      },
      {
        id: "unpaid-month",
        q: "What happens to a month we missed?",
        a: policy(refundPolicy, "if-a-payment-does-not-go-through", 4),
        link: refund,
        status: "live",
      },
      {
        id: "pause-or-stop",
        q: "How do we pause or stop classes?",
        a: policy(refundPolicy, "pausing-or-stopping-classes", 0),
        after: policy(refundPolicy, "pausing-or-stopping-classes", 1),
        link: refund,
        status: "live",
      },
      {
        id: "refunds",
        q: "When do you give refunds?",
        a: "We refund tuition in these cases:",
        points: [0, 1, 2, 3].map((i) => policy(refundPolicy, "refunds", i)),
        after: policy(refundPolicy, "refunds", 4),
        link: refund,
        status: "live",
      },
      {
        id: "statement",
        q: "How does the charge appear on my statement?",
        a: policy(refundPolicy, "how-payments-are-taken", 5),
        status: "live",
      },
    ],
  },
  {
    id: "programs",
    title: "Weekend and Summer programs",
    items: [
      reuse(weekendFaq, "Does the Weekend Ilm Program cost anything?", "weekend-cost", { label: programs.weekend.label, href: programs.weekend.href }),
      {
        id: "weekend-ages",
        q: "Who can join the Weekend Ilm Program?",
        // The live Weekend form's help text (iqu-registration class-iqu-weekend-form.php:304), verbatim.
        a: "Open to children aged 5 to 12.",
        status: "live",
      },
      {
        id: "weekend-times",
        q: "When are the Weekend Ilm Program classes?",
        // program-page.ts weekendFaq: the same first sentence, without "the schedule above", which only makes sense there.
        a: weekendFaq.find((i) => i.q === "What time are the classes where we live?")!.a.split(". ")[0] + ".",
        link: { label: programs.weekend.label, href: programs.weekend.href },
        status: "live",
      },
      reuse(summerFaq, "What does Summer Ilm Camp cost?", "summer-cost", { label: programs.summer.label, href: programs.summer.href }),
      { ...reuse(summerFaq, "Which level will my child join?", "summer-levels"), q: "Which Summer Ilm Camp level will my child join?" },
      { ...reuse(summerFaq, "Is there homework?", "summer-homework"), q: "Is there homework at the Summer Ilm Camp?" },
      {
        id: "program-language",
        q: "What language are the Weekend and Summer programs taught in?",
        // program-page.ts LANGUAGE_FAQ: the live course records list English for both programs.
        a: "English.",
        status: "live",
      },
    ],
  },
  {
    id: "giving",
    title: "Giving and Zakat",
    items: [
      { id: "where-donations-go", q: "Where do donations go?", a: donateHero.lead, link: give, status: "live" },
      {
        id: "tax-deductible",
        q: "Is my donation tax-deductible?",
        // /donate (the live Terms §4 wording) and the live Zeffy form ("You'll receive a tax receipt").
        a: giveCard.legal,
        after: giveCard.points[1],
        link: give,
        status: "live",
      },
      { id: "zakat", q: "Can I give my Zakat?", a: zakat.body[0], after: zakat.body[1], link: give, status: "live" },
      { id: "monthly-giving", q: "Can I give every month?", a: otherWays.body[0], after: otherWays.body[1], link: give, status: "live" },
      {
        id: "donation-refunds",
        q: "Are donations refundable?",
        // Live Terms and Conditions §4 (WP page 443), verbatim.
        a: policy(termsAndConditions, "donations", 1),
        link: { label: "Terms and Conditions", href: "/legal/terms" },
        status: "live",
      },
    ],
  },
];

/** Every question once, for the FAQPage structured data and the tests. */
export const faqEntries: FaqEntry[] = faqGroups.flatMap((g) => g.items);

/** The end of the page: the contact line, then the enrollment band. */
export const faqContact = {
  heading: "Still have questions?",
  // Home §9's line (FAQAccordion).
  text: "Something else on your mind? Ask us directly.",
  link: { label: "Contact us", href: "/contact" },
} as const;
