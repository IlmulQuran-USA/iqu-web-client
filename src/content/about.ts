import { aid } from "./aid.ts";
import { site } from "./site.ts";

/*
 * /about (spec §7.6; plan F:/iqu-setup/reports/giving-about-shape-plan.md
 * Page 2; owner, 26 Nov 2026).
 *
 * Source: the live About page (WordPress page 18, read-only via Novamira,
 * 26 Nov 2026). Mission, history, goal and legal identity are the live
 * wording. Two departures, both house rules:
 *   - "Qur'an" is written "Quran" (CLAUDE.md §4, owner 21 Nov 2026);
 *   - the phone is site.ts's (+1 (214) 529-3544, PRODUCT.md K2), never the
 *     About page's outdated (214) 662-1591;
 *   - the IRS document is described as what it is: the CP 575 assigns the
 *     EIN; it is not the 501(c)(3) determination letter (CONTENT-ADDENDUM §6).
 * The fee-help share is the corrected claim (./aid.ts), never "nearly half
 * study free".
 *
 * Not rendered until the owner supplies them (listed by content:check):
 * the founding year, the timeline, leadership and staff, and the IRS
 * determination letter.
 */

export const aboutMeta = {
  title: "Our story",
  description:
    "Ilm-Ul-Quran USA is operated by AL HASANAH FOUNDATION, a 501(c)(3) nonprofit. Our mission, history and goal, how we teach, and our legal identity.",
};

export const aboutHeader = {
  title: "Our story",
  // Live About intro, first sentence. Its second sentence (the mission) is the Mission card, so it is not said twice.
  lead: "Ilm-Ul-Quran USA is operated by AL HASANAH FOUNDATION, a 501(c)(3) nonprofit organization (EIN: 93-3902300).",
};

/** Live About intro, second paragraph, and the History section. */
export const aboutStory = {
  heading: "History",
  body: [
    "We understand the unique challenges Muslims face in maintaining their faith today. That's why Ilm-Ul-Quran USA offers accessible, flexible programs for kids, teenagers, and working professionals.",
    "Ilm-Ul-Quran USA empowers Muslims in the US by deepening their connection to the Quran and authentic Islamic values. Founded as an online Quran learning initiative, it has grown into a nationwide platform serving diverse communities. We offer well-structured programs in Quran recitation, Tajweed, memorization, and Islamic studies for kids, teens, and adults. Each course is flexible, accessible, spiritually enriching—helping students live by the Quran’s guidance and Islamic principles every day.",
  ],
  /** Owner Q4: the founding year. The history says none until it is supplied. */
  foundingYear: { status: "pending", label: "Founding year" },
};

/** Mission (live About intro; CONTENT-ADDENDUM §1) and Goal (live About "Goal"). */
export const aboutMissionGoal = [
  {
    title: "Mission",
    text: "We spread the light of Quranic knowledge across the United States and Canada, providing high-quality Quranic education to learners of all ages and backgrounds.",
  },
  {
    title: "Goal",
    text: "Building a strong and united Ummah by fostering a deep connection with the Quran and the principles of Islam. We envision a community where every individual, regardless of age or background, has access to high-quality Quranic education, empowering them to live with faith, compassion, and purpose. Through our efforts, we aim to nurture a generation firmly grounded in Islamic values, contributing positively to society and inspiring others with the light of the Quran.",
  },
] as const;

/** Help with fees: the corrected claim and the ask-for-help line (./aid.ts). */
export const aboutFees = {
  heading: "Help with fees",
  text: aid.help.text,
  link: { label: "How to ask for help", href: "/scholarship" },
};

/** The live "Take a Simple Process" band, in house style (sentence case; "Quran"). */
export const aboutTeaching = {
  heading: "How we teach",
  intro:
    "Start your journey toward Quranic knowledge with just a few simple steps! Explore our programs, select the course that suits your needs, and complete the registration process with ease.",
  items: [
    {
      title: "Until you reach mastery",
      text: "Learn at your own pace with continuous support until you confidently recite the Quran with proper Tajweed.",
    },
    {
      title: "One-on-one or a small group",
      // Live: "…join a small group class flexible options designed…" (a missing colon restored).
      text: "Choose personalized one-on-one sessions or join a small group class: flexible options designed to fit your schedule.",
    },
    {
      title: "Female teachers for girls and kids",
      text: "Our qualified female tutors provide a safe, nurturing environment for girls and young children to learn the Quran.",
    },
  ],
  link: { label: "See all courses", href: "/courses" },
} as const;

/** Live About "Meet Our Dedicated Teachers". */
export const aboutTeachers = {
  heading: "Our teachers",
  text: "At Ilm-Ul-Quran USA, we are blessed with a team of qualified and passionate teachers who are committed to nurturing a deep connection with the Quran and Islamic principles. With expertise in Quranic recitation, Tajweed, memorization, and Islamic studies, our educators provide personalized guidance to students of all ages and backgrounds.",
  link: { label: "Meet our teachers", href: "/instructors" },
};

/**
 * Legal identity (live About "Organization Information"). The phone and email
 * come from site.ts, so a change there reaches this card.
 */
export const aboutLegal = {
  heading: "Organization information",
  rows: [
    { label: "Legal name", value: site.legalName },
    { label: "Operating name", value: site.name },
    { label: "Tax status", value: "501(c)(3) nonprofit organization" },
    { label: "EIN", value: site.ein },
    // Live: "IRS Recognition: EIN Verification Letter (CP 575), issued October 13, 2023". A CP 575 is the
    // IRS notice that assigns the EIN; it is not the 501(c)(3) determination letter, so it is not called that.
    { label: "EIN assigned", value: "IRS notice CP 575, 13 Oct 2023" },
    { label: "Address", value: `${site.address.line1}, ${site.address.line2}, United States` },
  ],
  contact: { phone: site.phone, email: site.email },
  ownership: "ilmulquranus.org is the official website of AL HASANAH FOUNDATION and is owned and operated by the organization.",
  /** Owner Q5: the IRS 501(c)(3) determination letter (PDF and date). Shown here once supplied. */
  determinationLetter: { status: "pending", label: "IRS 501(c)(3) determination letter" },
};

/** Spec §7.6 sections 4 and 6: not rendered until the owner supplies dated events and people (Q4, spec §8 #16). */
export const aboutPending = [
  { status: "pending", label: "Timeline (founding, first cohort, 501(c)(3) recognition, first Summer Ilm Camp)", items: [] as string[] },
  { status: "pending", label: "Leadership and staff (photo, role, one-line bio)", items: [] as string[] },
] as const;

/**
 * Spec §7.6 section 8, split CTA: the enrollment band is Home's approved final
 * call to action (the page's one filled button); giving is this quiet line and
 * a text link, never a competing button (PRODUCT.md: enrollment and giving
 * stay apart). Framing: PRODUCT.md "Donations, including Zakat, go to the
 * scholarship fund"; never that they pay for every place.
 */
export const aboutGiving = {
  text: `${site.name} is a ${site.taxStatus}. Donations, including Zakat, support our scholarship fund.`,
  link: { label: "Support our work", href: "/donate" },
};
