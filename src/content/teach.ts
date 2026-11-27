import { courseRules } from "./courses.ts";
import { monthlyCourses, programs, sessionLengths } from "./pricing.ts";
import { site } from "./site.ts";

/*
 * /teach — Teach with us (spec §7.16; owner, 27 Nov 2026). The live
 * /instructor-registration page has no text and no form (it shows an
 * unrendered Tutor LMS shortcode), so every sentence here is a live site fact
 * or a settled rule, each marked with its source. Nothing about pay, training,
 * requirements or the hiring steps: spec §7.16 lists them, but no live text or
 * PRODUCT.md decision says what they are, so they stay pending and unshown.
 */

export const teachMeta = {
  title: "Teach with us",
  description: `Apply to teach the Quran and Islamic studies live online with ${site.name}, for families in the United States and Canada.`,
} as const;

export const teachHeader = {
  title: "Teach with us",
  // site.mission (live): "Live Quran and Islamic classes taught by qualified Huffaz, Ulama and Mufti, …"
  lead: `${site.name} runs live Quran and Islamic classes taught by qualified Huffaz, Ulama and Mufti, for families in the United States and Canada. If you are qualified to teach, apply below.`,
} as const;

/** How classes run: each line a settled fact. */
export const teachFacts = {
  heading: "How our classes work",
  items: [
    courseRules.format.text, // live
    `Classes are ${sessionLengths} long.`, // pricing.ts, the live plugin's list
    "Families live in the United States and Canada, and each class is scheduled in the family’s time zone: Eastern, Central, Mountain, Pacific or Atlantic.", // PRODUCT.md time zones
    courseRules.languages.text, // live
    courseRules.teacherAssignment.text, // settled (owner): the teacher rule
  ],
} as const;

/** The courses and programs taught today (pricing.ts). */
export const teachCourses = {
  heading: "What we teach",
  items: [...monthlyCourses.map((c) => ({ label: c.label, href: c.href })), ...Object.values(programs).map((p) => ({ label: p.label, href: p.href }))],
} as const;

export const teachForm = {
  heading: "Apply to teach",
  intro: "Your application goes straight to our team. Fields marked optional can be left empty.",
  closed: "Applications open soon.",
  // [label](href): rendered as a link by InlineText.
  closedHelp: site.email
    ? `Until then, please email us at [${site.email}](mailto:${site.email}) with your name, your qualifications and the courses you can teach.`
    : "[pending]",
  sent: "Thank you. We received your application, and it has gone to our team.",
  button: "Send application",
  privacy: "We use your details only to review your application.",
} as const;

/** Spec §7.16 items with no live or PRODUCT.md source yet: not shown (content:check lists them). */
export const teachPending = [
  { status: "pending", label: "Why teach with us (stipend, training, schedule, community)", items: [] as string[] },
  { status: "pending", label: "What we look for (qualification, Ijazah/sanad, English, internet and device)", items: [] as string[] },
  { status: "pending", label: "Hiring process (apply → screening → demo class → onboarding)", items: [] as string[] },
] as const;
