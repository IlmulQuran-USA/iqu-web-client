import { HELP_LEVELS } from "../lib/enroll/options.ts";
import { afterPercentOff, formatUsd, toCents } from "../lib/money.ts";
import { aid } from "./aid.ts";
import { courseById, monthlyFee } from "./pricing.ts";

/*
 * /scholarship: "Help with fees" (spec §7.18; plan approved by the owner,
 * answers 1–4 yes, recorded in IQU-handoff-2026-11-23.md §7.5).
 *
 * Every line is live or derived from live facts:
 * - the ask: aid.askForHelp (owner, 22 Nov 2026): listed prices are the full
 *   fees; help is something a family asks for, never a discount for everyone;
 * - the levels: the enrollment form's own (src/lib/enroll/options.ts);
 * - the example: the published Noorani Qaidah fee (./pricing), worked out in cents;
 * - "No child's place is ever affected by cost." and "talk to us": the
 *   Tuition, Payment & Refund Policy (16 Nov 2026), quoted as written;
 * - the share: aid.helpShare (live data, 25 Nov 2026; PRODUCT.md);
 * - how to ask: the /enroll Fees step and its confirmation (P1).
 * The Zakat application form, verification and fund segregation of §7.18
 * are not built: they wait for the owner's Zakat policy.
 */

const exampleCourse = courseById("noorani-qaidah");
const exampleDays = 3;
const exampleFee = toCents(monthlyFee(exampleCourse, exampleDays));

export const scholarshipMeta = {
  title: "Help with fees",
  description:
    "Families who need help can ask for a reduced fee (30%, 45% or 50% off) or a full scholarship. No child’s place is ever affected by cost.",
} as const;

export const scholarshipHeader = {
  title: "Help with fees",
  intro: aid.askForHelp.text,
} as const;

export type Level = { label: string; youPay: string; example: string };

const examplePays = HELP_LEVELS.map((h) => (h.percent >= 100 ? 0 : afterPercentOff(exampleFee, h.percent)));
// One column of amounts, one format: "$24.00" beside "$33.60", never "$24".
const withCents = examplePays.some((c) => c % 100 !== 0);
const amount = (c: number) => (withCents && c % 100 === 0 ? `${formatUsd(c)}.00` : formatUsd(c));

export const feeScale = {
  heading: "What you can ask for",
  levels: HELP_LEVELS.map((h, i): Level => {
    const pay = examplePays[i];
    return {
      label: h.percent >= 100 ? "Full scholarship" : h.label,
      youPay: h.percent >= 100 ? "The scholarship covers the whole fee." : `You pay ${100 - h.percent}% of the listed fee.`,
      example: pay === 0 ? "Nothing" : `${amount(pay)} a month`,
    };
  }),
  exampleNote: `Example: ${exampleCourse.label}, ${exampleDays} days a week, listed at ${formatUsd(exampleFee)} a month.`,
  // Never a discount for everyone (owner, 22 Nov 2026).
  everyoneNote: "These are not discounts for everyone. Each family asks for the help it needs, and the rest pay the listed fees.",
} as const;

export const dignity = {
  statement: "No child’s place is ever affected by cost.",
  body: [
    "If the fee is a burden for your family, please talk to us. You don’t need to explain more than you want to, and we keep your request private.",
    aid.helpShare,
  ],
} as const;

export const howToAsk = {
  heading: "How to ask",
  steps: [
    {
      title: "Choose “I need help with the fee”",
      body: "Enroll as usual. On the Fees step, choose “I need help with the fee” and how much help you would like. You can add a short note if you wish.",
    },
    {
      title: "We agree the fee with you",
      body: "Our team contacts you on WhatsApp within 24–48 hours to agree the fee, privately. You add a card only if there is a fee to pay.",
    },
  ],
} as const;

export const donorLine = {
  text: "Scholarships are paid for by Zakat and donations.",
  link: { label: "Support a student", href: "/donate" },
} as const;

export const scholarshipFinal = {
  heading: "Ask for help with fees",
  button: { label: "Ask for help with fees", href: "/enroll?aid=request" },
  reassurance: "Asking never affects your child’s place.",
} as const;
