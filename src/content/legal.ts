import { PENDING, site } from "./site.ts";

/*
 * The legal pages under /legal/* (spec §6.2 legal strip, §7.0 route map).
 *
 * Privacy, Terms and the Tuition, Payment & Refund Policy are ported VERBATIM
 * from the live WordPress pages (read-only via Novamira, 26 Nov 2026: pages
 * 3, 443 and 1366). Only internal links point to the new paths. Every
 * departure from the live wording is a `change` on the block or list item,
 * with the live wording (`old`) and the reason:
 *   - status "live": settled by PRODUCT.md / PLUGIN-INVENTORY.md (the billing
 *     rules on the Tuition page). Not marked on the page.
 *   - status "draft": proposed (the Privacy updates for how the new site
 *     works). Marked on the page and listed by `npm run content:check`, so
 *     none ships before the owner approves it.
 * A "remove" change keeps the live text here, so the record stays complete:
 * a draft removal is shown struck through, a live one is not rendered.
 *
 * Inline text: **bold** and [label](href) only.
 * Report: F:/iqu-setup/reports/legal-pages.md.
 */

export type LegalChange = {
  status: "live" | "draft";
  kind: "add" | "edit" | "remove";
  /** One line: what changes (also the content:check preview). */
  label: string;
  /** The live wording, or null for an addition. */
  old: string | null;
  reason: string;
};

export type LegalItem = { text: string; change?: LegalChange };

export type LegalBlock =
  | { type: "p"; text: string; change?: LegalChange }
  | { type: "list"; items: LegalItem[] }
  /** Short lines with no gap (the contact block). */
  | { type: "lines"; lines: string[] };

export type LegalSection = { id: string; title: string; titleChange?: LegalChange; blocks: LegalBlock[] };

export type LegalDoc = {
  slug: "privacy" | "terms" | "refund" | "accessibility";
  path: `/legal/${string}`;
  title: string;
  /** The line under the title (the live page's subtitle). */
  lead: string;
  /** Meta description. */
  description: string;
  /**
   * "Last updated", as 30 Aug 2026. Privacy, Refund and Accessibility show the
   * cutover date (owner, 26 Nov 2026): [pending] until that day.
   */
  updated: string;
  /** "draft" for a page with no live equivalent that the owner has not approved. */
  status: "live" | "draft";
  /** The live WordPress page this is ported from, or null. */
  source: { wpId: number; url: string; updated: string } | null;
  intro: LegalBlock[];
  sections: LegalSection[];
};

const EMAIL = "[info@ilmulquranus.org](mailto:info@ilmulquranus.org)";

/* ── Privacy Policy (live page 3, last updated November 10, 2026) ─────────── */

export const privacyPolicy: LegalDoc = {
  slug: "privacy",
  path: "/legal/privacy",
  title: "Privacy Policy",
  lead: "How we collect, use and protect your family’s information.",
  description:
    "How Ilm-Ul-Quran USA collects, uses and protects your family’s information: what we collect, who we share it with, cookies, children’s privacy and your rights.",
  // The cutover date (owner, 26 Nov 2026), when the proposed changes below take effect.
  updated: PENDING,
  status: "live",
  source: { wpId: 3, url: "https://ilmulquranus.org/privacy-policy/", updated: "10 Nov 2026" },
  intro: [],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        {
          type: "p",
          text: `Ilm-Ul-Quran USA ([ilmulquranus.org](https://ilmulquranus.org)) provides online Quran and Islamic education. It is operated by AL HASANAH FOUNDATION, a 501(c)(3) nonprofit organization (EIN 93-3902300) based in Richardson, Texas. This policy explains what personal information we collect, why, who we share it with, and the choices you have. Questions: ${EMAIL}.`,
        },
      ],
    },
    {
      id: "information-we-collect",
      title: "Information we collect",
      blocks: [
        {
          type: "list",
          items: [
            {
              text: "**Enrollment details** you give us on our forms: the student's name, date of birth, country, Quran level, preferred days and times, languages and teacher preference; the parent or guardian's name; email address and WhatsApp number; and how you heard about us.",
            },
            {
              text: "**Billing details:** your monthly tuition amount, payment dates and payment status. Card and bank details are entered on Stripe's secure page and stay with Stripe; we only see the card brand or bank name and the last four digits.",
            },
            {
              text: "**Enrollment record:** when you submit an enrollment form, we save the country estimated from the IP address of the device used, and your choice for marketing cookies in the cookie banner, together with the enrollment. We do not save the IP address or the browser information. If you accepted marketing cookies, we also save Meta's cookie identifiers with the enrollment (see Meta, below).",
              change: {
                status: "draft",
                kind: "edit",
                label: "Enrollment record: no IP address or browser information saved",
                old: "Enrollment record: when you submit an enrollment form, we save the IP address and browser information of the device used, the country estimated from that IP address, and your choice for marketing cookies in the cookie banner, together with the enrollment.",
                reason:
                  "Owner decision 1 (PRODUCT.md, 24 Nov 2026): the raw IP is no longer stored. The new form saves only the IP country, the consent choice, and Meta's _fbp/_fbc cookies when consent is granted; IP and user agent are not saved (src/lib/server/enroll/submit.ts).",
              },
            },
            {
              text: "**Messages you send us** through our contact form: your name, email address, phone number if you give one, the topic and your message. They are emailed to our team, and the website does not keep a copy once the email has been sent.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: contact form messages",
                old: null,
                reason:
                  "The new /contact form sends messages to the team inbox through the Gmail mailer; the queued copy's body is dropped once sent (src/lib/server/contact.ts, outbox.ts).",
              },
            },
            // No Brevo line (owner, 26 Nov 2026: Privacy names only tools in use). Brevo is not in use
            // yet: the footer form shows "Sign-up opens soon." until BREVO_* is set. Add a newsletter
            // line here, and Brevo under "Who we share it with", before switching the newsletter on.
            { text: "**Donations** made through Zeffy, which processes the payment and shares the donor's name, email and amount with us." },
            {
              text: "**Technical information** when you visit our website, such as IP address, browser and device type, and pages visited, collected through cookies and similar tools (see below).",
            },
          ],
        },
      ],
    },
    {
      id: "how-we-use-it",
      title: "How we use it",
      blocks: [
        {
          type: "list",
          items: [
            { text: "To place students in classes, match them with a teacher and arrange class times." },
            {
              text: "To work out the student's age from their date of birth, so we can place them in the right class and level, check that they are within the ages we teach (4 to 100), ask for a parent or guardian's details when the student is under 18, and send a birthday greeting.",
            },
            {
              text: "To confirm that new students live in the United States or Canada, where our classes are offered. We check the country code of the phone number, the country estimated from the IP address, and the country of the card added on Stripe. The country is estimated from the IP address by our website host, Vercel, as the form is sent; we keep only the country, not the IP address. If the checks do not match, our team reviews the enrollment or adds the family to a waitlist.",
              change: {
                status: "draft",
                kind: "edit",
                label: "Location check: country from Vercel, not MaxMind",
                old: "… The IP country is looked up on our own server using the MaxMind GeoLite2 database; your IP address is not sent to MaxMind. If the checks do not match, our team reviews the enrollment or adds the family to a waitlist.",
                reason:
                  "The new form reads the country from Vercel's x-vercel-ip-country header and stores only the country (src/app/actions/enroll.ts, src/lib/server/enroll/eligibility.ts). No MaxMind database on the new site.",
              },
            },
            {
              text: "To limit repeated or automated form submissions. For this we count submissions by a scrambled (hashed) form of the IP address and email address; the IP address and email address themselves are not saved for this.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: rate limits use hashed IP and email",
                old: null,
                reason:
                  "The new forms rate-limit by HMAC keys only; the database refuses a raw IP or email as a key (src/lib/server/rate.ts, keys.ts).",
              },
            },
            { text: "To contact families by email and WhatsApp about classes, progress and billing." },
            { text: "To take monthly tuition, send receipts, and help when a payment does not go through." },
            { text: "To send updates about our programs to families who asked for them. You can stop these at any time." },
            { text: "To keep our website secure and to understand which pages and advertisements are useful." },
          ],
        },
      ],
    },
    {
      id: "who-we-share-it-with",
      title: "Who we share it with",
      blocks: [
        {
          type: "p",
          text: "We do not sell personal information. We share it only with service providers that help us run classes and payments, and only as much as each one needs:",
        },
        {
          type: "list",
          items: [
            {
              text: "**Stripe** — processes tuition payments by card and US bank account, and tells us the country of the card, which we use for the location check described above.",
            },
            { text: "**Zeffy** — processes donations." },
            { text: "**Zoom** — hosts online classes." },
            {
              text: "**Google** — sends our emails (Gmail), protects our forms from spam (reCAPTCHA), and measures website use (Google Analytics).",
            },
            {
              text: "**Meta** — measures the results of our Facebook and Instagram advertisements. In your browser this is done by the Meta Pixel. Our server also sends Meta a notice (Meta Conversions API) when an enrollment form is submitted, when a card or bank account is added for monthly tuition, and when a Summer program payment is completed. Each notice contains: the email address, phone number and country, and the parent's or guardian's name (or an adult student's own name), all in scrambled (hashed) form; for the enrollment notice, the IP address and browser information of the device used to send the form, passed to Meta at that moment and not saved by us; Meta's own cookie identifiers, including the ad click ID when you arrived from an ad; and the program name and amount. We never send a child's name, a student's date of birth or age, notes or payment details. No notice is sent unless you chose “Accept” for marketing cookies, and none for students added by our team. Meta uses these notices to match them to its users and report advertising results to us.",
              change: {
                status: "draft",
                kind: "edit",
                label: "Meta: IP passed at sending, not saved; notices only after Accept",
                old: "… the IP address and browser information saved with the enrollment; … No notice is sent if you chose “Deny” for marketing cookies, or for students added by our team.",
                reason:
                  "Owner decision 1: the IP goes to Meta only with marketing consent and is never stored, so later notices (card added, Summer payment) can no longer include it. The new site treats no answer as no consent (src/lib/consent.ts), which is stricter than the live “unless Deny”. Meta notices are queued only; they are delivered with the consent banner before cutover (PRODUCT.md).",
              },
            },
            {
              text: "**MaxMind** — provides the GeoLite2 location database that we keep on our own server. We do not send your information to MaxMind. This website includes GeoLite2 data created by MaxMind, available from [maxmind.com](https://www.maxmind.com).",
              change: {
                status: "draft",
                kind: "remove",
                label: "Remove MaxMind once the WordPress enrollment form is off",
                old: "MaxMind — provides the GeoLite2 location database that we keep on our own server. We do not send your information to MaxMind. This website includes GeoLite2 data created by MaxMind, available from maxmind.com.",
                reason:
                  "The new site does not use GeoLite2 (the country comes from Vercel). Keep this item, and its attribution, while the WordPress plugin still runs its own location check.",
              },
            },
            {
              text: "**WhatsApp and Telegram** — WhatsApp for messages with families; Telegram for internal notifications to our team about new enrollments and payments.",
            },
            {
              text: "**Vercel** — hosts this website, and estimates each visitor's country from their IP address (see the location check above).",
              change: {
                status: "draft",
                kind: "edit",
                label: "Website host: Vercel, Neon, and WordPress while pages move",
                old: "Our website host — stores the website and its database.",
                reason:
                  "The new site is hosted on Vercel with its database on Neon (PRODUCT.md; DEPLOYMENT.md). Donations (Zeffy records) and the card and Summer payment pages stay on WordPress for now (PRODUCT.md, decision 11 and “Zeffy donations stay on WordPress”).",
              },
            },
            {
              text: "**Neon** — stores our website database.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: Neon (database)",
                old: null,
                reason: "The new site's database is Neon Postgres (src/db, @neondatabase/serverless).",
              },
            },
            {
              text: "**Our WordPress host** — stores donation records and the payment pages that have not yet moved to this website.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: WordPress host while pages move",
                old: null,
                reason: "Zeffy donations and the card and Summer payment pages stay on WordPress for v1 (PRODUCT.md).",
              },
            },
            { text: "We may also share information when the law requires it." },
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies and similar tools",
      blocks: [
        {
          type: "p",
          text: "Our website uses cookies for basic functions, for statistics (Google Analytics) and for advertising measurement (Meta Pixel). When you first visit, a cookie banner lets you accept or decline non-essential cookies, and “Cookie settings” at the bottom of every page lets you choose each kind and change your choice at any time. Functional cookies are always on: they keep the site working, protect our forms from spam (Google reCAPTCHA) and remember your cookie choices. Where we can tell which country you are in, Google Analytics runs unless you decline it; in Québec, and where we cannot tell, it runs only if you accept it. If your browser sends a Global Privacy Control signal, we treat it as declining both analytics and marketing until you choose otherwise. The Meta Pixel never runs unless you accept marketing cookies (“Accept all”, or Marketing in Cookie settings), and without that choice our server does not send Meta any notice about your enrollment. Your choices are kept in cookies on your device for 365 days. Embedded content from other websites, such as videos or donation forms, may set its own cookies. Your choice is saved with your enrollment and also applies to the notices sent later, when payment is set up or completed. The location check described above is part of processing an enrollment and is not affected by this choice.",
          change: {
            status: "draft",
            kind: "edit",
            label: "Cookies: what the new banner does (analytics on unless declined where the country is known; Meta only after Accept)",
            old: "Our website uses cookies for basic functions, for statistics (Google Analytics) and for advertising measurement (Meta Pixel). When you first visit, a cookie banner lets you accept or refuse non-essential cookies, and you can change your choice at any time from the same banner. Embedded content from other websites, such as videos or donation forms, may set its own cookies. If you choose “Deny” for marketing cookies in the cookie banner, the Meta Pixel is blocked and our server does not send Meta any notice about your enrollment. Your choice is saved with your enrollment and also applies to the notices sent later, when payment is set up or completed. The location check described above is part of processing an enrollment and is not affected by this choice.",
            reason:
              "The new banner (src/components/consent, src/lib/consent.ts; owner, 27 Nov 2026, “hybrid”): live Complianz is opt-out for the US, Canada and every other country; the new site keeps analytics opt-out where the country is known (x-vercel-ip-country), except Québec (opt-in, x-vercel-ip-country-region QC; owner, 27 Nov 2026), makes marketing opt-in everywhere (no answer is no consent: stricter than the live “if Deny”), uses opt-in for both when the country is unknown, honours Global Privacy Control, and keeps the live 365-day lifetime. The footer link “Cookie settings” replaces the live “Manage consent” tab.",
          },
        },
        {
          type: "list",
          items: [
            {
              text: "**Functional (always on):** iqu_statistics_consent and iqu_marketing_consent (your choices, 365 days); iqu_country (the two-letter code of the country you are in, and whether you are in Québec, used to choose the defaults above, deleted when you close your browser; we never keep the IP address for this); Google reCAPTCHA on our forms.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: the functional cookies, by name",
                old: null,
                reason: "Exactly what the new site sets (src/lib/consent.ts COOKIES; src/proxy.ts sets iqu_country from x-vercel-ip-country as a session cookie, CA-QC when x-vercel-ip-country-region is QC: owner, 27 Nov 2026, analytics opt-in in Québec). The live Complianz cookies (cmplz_*) are no longer set.",
              },
            },
            {
              text: "**Analytics:** Google Analytics (_ga, _ga_*, set by Google for up to 2 years). Removed from your browser when you decline.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: the analytics cookies, by name",
                old: null,
                reason: "GA4 G-7QQ7S0EX1T loaded directly with Consent Mode v2 (no Google Tag Manager); retention as Google sets it (live Complianz cookie list: _ga 2 years). Declining deletes _ga cookies on this site.",
              },
            },
            {
              text: "**Marketing:** Meta Pixel (_fbp for 3 months and _fbc for up to 2 years, set by Meta). Removed from your browser when you decline.",
              change: {
                status: "draft",
                kind: "add",
                label: "New: the marketing cookies, by name",
                old: null,
                reason: "Meta Pixel 1756660502407987 loaded directly (live Complianz cookie list: _fbp 3 months, _fbc 2 years). No Google Ads tag (owner, 27 Nov 2026). Declining deletes _fbp/_fbc and revokes the Pixel's consent.",
              },
            },
          ],
        },
        {
          type: "p",
          text: "**Saved on your device.** While you fill in the enrollment form, your answers are saved in your browser on this device, so you can come back to them. They are not sent to us until you submit the form. After you submit, the parent or guardian's name, contact details, country and time zone stay in your browser so that enrolling a brother or sister starts already filled in; they are removed once used. Choosing “Start over” on the form, or clearing your browser's data for this website, removes them.",
          change: {
            status: "draft",
            kind: "add",
            label: "New: enrollment draft saved on the device",
            old: null,
            reason:
              "Owner decision 10: v1 saves progress in localStorage only (src/components/enroll/EnrollFlow.tsx, src/lib/enroll/keys.ts: the draft, the sibling seed used once, and the first name for the confirmation tab).",
          },
        },
      ],
    },
    {
      id: "childrens-privacy",
      title: "Children's privacy",
      blocks: [
        {
          type: "p",
          text: "Many of our students are children. We collect a child's information only from the parent or guardian who enrolls them, and use it only to provide classes. Billing messages go to the parent or guardian. A parent or guardian can ask to see, correct or delete their child's information at any time.",
        },
      ],
    },
    {
      id: "how-long-we-keep-it",
      title: "How long we keep it",
      blocks: [
        {
          type: "p",
          text: "We keep enrollment and billing records while a student is with us and for up to 7 years afterwards, as required for nonprofit financial records. Website statistics are kept for the period set in Google Analytics. You can ask us to delete information we are not required to keep.",
        },
      ],
    },
    {
      id: "how-we-protect-it",
      title: "How we protect it",
      blocks: [
        {
          type: "p",
          text: "Access to student and billing records is limited to our team. Payment details are handled by Stripe, a certified payment processor. Each family's billing page is reached through a private link that can be replaced at any time.",
        },
      ],
    },
    {
      id: "your-choices-and-rights",
      title: "Your choices and rights",
      blocks: [
        {
          type: "list",
          items: [
            { text: "Ask for a copy of the information we hold about you or your child." },
            { text: "Ask us to correct or delete it." },
            { text: 'Stop program updates by replying "stop" or emailing us.' },
            { text: "Refuse non-essential cookies through the cookie banner." },
          ],
        },
        { type: "p", text: `To make a request, email ${EMAIL}. We reply within 30 days.` },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [{ type: "p", text: "We post any changes on this page with a new date, and email families about important changes." }],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        {
          type: "lines",
          lines: [
            "Ilm-Ul-Quran USA, operated by AL HASANAH FOUNDATION",
            "Richardson, Texas",
            `Email: ${EMAIL}`,
            "Related: [Terms and Conditions](/legal/terms) · [Tuition, Payment & Refund Policy](/legal/refund)",
          ],
        },
      ],
    },
  ],
};

/* ── Terms and Conditions (live page 443, last updated October 6, 2026) ──── */

export const termsAndConditions: LegalDoc = {
  slug: "terms",
  path: "/legal/terms",
  title: "Terms and Conditions",
  lead: "The rules for using our website, classes and services.",
  description:
    "The terms for using the Ilm-Ul-Quran USA website, classes and services: conduct, tuition and payments, donations, attendance, privacy and content use.",
  updated: "6 Oct 2026",
  status: "live",
  source: { wpId: 443, url: "https://ilmulquranus.org/terms-and-conditions/", updated: "6 Oct 2026" },
  intro: [
    {
      type: "p",
      text: "Welcome to Ilm-Ul-Quran USA. By accessing and using our website, programs, and services, you agree to comply with the following terms and conditions. Please read them carefully. Ilm-Ul-Quran USA is operated by AL HASANAH FOUNDATION, a 501(c)(3) nonprofit organization (EIN 93-3902300) based in Richardson, Texas. For a student under 18, the parent or guardian who enrolls the student agrees to these terms on the student's behalf.",
    },
  ],
  sections: [
    {
      id: "use-of-the-website-and-services",
      title: "1. Use of the Website and Services",
      blocks: [
        {
          type: "list",
          items: [
            { text: "Ilm-Ul-Quran USA provides online Quran and Islamic education through scheduled classes, resources, and communication tools." },
            {
              text: "All users must ensure that any information provided during registration is accurate and up to date, especially the email address where receipts and billing messages are sent.",
            },
            { text: "You agree not to misuse the website or disrupt any services provided." },
          ],
        },
      ],
    },
    {
      id: "student-conduct",
      title: "2. Student Conduct",
      blocks: [
        {
          type: "list",
          items: [
            { text: "Students are expected to attend classes punctually, complete assignments, and show respect toward teachers and fellow students." },
            { text: "Any misconduct, inappropriate language, or disrespect may result in suspension or removal from the program." },
          ],
        },
      ],
    },
    {
      id: "tuition-and-payments",
      title: "3. Tuition and Payments",
      blocks: [
        {
          type: "list",
          items: [
            { text: "While many programs are offered free or with financial assistance, some courses require tuition fees." },
            {
              text: "Monthly tuition is collected automatically through our payment processor, Stripe, as explained in our [Tuition, Payment & Refund Policy](/legal/refund), which forms part of these terms.",
            },
            { text: "Tuition is refunded only in the cases listed in that policy." },
            {
              text: "Each family receives a private link to its billing page. Please do not share it; if you think someone else has it, tell us and we will send a new one.",
            },
            { text: "No child's place is ever affected by cost. Families who need help should contact us." },
          ],
        },
      ],
    },
    {
      id: "donations",
      title: "4. Donations",
      blocks: [
        {
          type: "list",
          items: [
            { text: "Donations are received by AL HASANAH FOUNDATION, a 501(c)(3) nonprofit organization, and may be tax-deductible as allowed by law." },
            { text: "Donations are non-refundable unless otherwise stated in writing or made by mistake." },
          ],
        },
      ],
    },
    {
      id: "attendance-policy",
      title: "5. Attendance Policy",
      blocks: [
        {
          type: "list",
          items: [
            { text: "Consistent attendance is crucial for progress. Students missing multiple classes without notice may be contacted or removed from the course." },
            { text: "Parents are encouraged to monitor and support their children's regular participation." },
            {
              text: "To reschedule a class, tell your teacher or our team at least 24 hours before it starts and we arrange a make-up class. Classes missed without notice are not made up.",
            },
            { text: "If your teacher cancels a class, it is made up at a time that suits you, or taken off your next month's tuition." },
          ],
        },
      ],
    },
    {
      id: "privacy",
      title: "6. Privacy",
      blocks: [
        {
          type: "list",
          items: [
            {
              text: "Personal information provided to Ilm-Ul-Quran USA will be handled with care and used only for internal purposes such as class management, communication, billing, and student progress tracking.",
            },
            {
              text: "We do not sell your data. We share it only with service providers that help us run classes and payments, such as Stripe, which processes card and bank payments. We never see or store your full card or bank details. See our [Privacy Policy](/legal/privacy).",
            },
          ],
        },
      ],
    },
    {
      id: "content-usage",
      title: "7. Content Usage",
      blocks: [
        {
          type: "list",
          items: [
            {
              text: "All content on this website, including lesson materials, recordings, and graphics, is the intellectual property of Ilm-Ul-Quran USA and may not be copied, reproduced, or redistributed without written permission.",
            },
          ],
        },
      ],
    },
    {
      id: "changes-to-programs-or-terms",
      title: "8. Changes to Programs or Terms",
      blocks: [
        {
          type: "list",
          items: [
            {
              text: "Ilm-Ul-Quran USA reserves the right to modify or discontinue any part of its programs or terms. We tell families at least 30 days before any change to tuition fees, and we email families about important changes to these terms.",
            },
            { text: "Continued use of our services constitutes acceptance of any such changes." },
          ],
        },
      ],
    },
    {
      id: "disclaimer",
      title: "9. Disclaimer",
      blocks: [
        {
          type: "p",
          text: "All teachings are based on authentic sources to the best of our understanding and intention. While we strive to provide accurate and beneficial Islamic education, Ilm-Ul-Quran USA does not take responsibility for any misinterpretation of content.",
        },
      ],
    },
    {
      id: "governing-law-and-contact",
      title: "10. Governing Law and Contact",
      blocks: [{ type: "p", text: `These terms are governed by the laws of the State of Texas, United States. Questions: ${EMAIL}` }],
    },
  ],
};

/* ── Tuition, Payment & Refund Policy (live page 1366, November 16, 2026) ── */

/** K1 (PRODUCT.md, closed 24 Nov 2026): the one sentence all copy uses. */
const K1 = "After the free first month, tuition is charged on the 1st of each month.";
const BILLING_REASON = `K1, closed by the owner 24 Nov 2026 (PRODUCT.md): "${K1}" "Charged monthly on your billing date" is retired. PLUGIN-INVENTORY §4.2: everyone is billed on the 1st.`;

export const refundPolicy: LegalDoc = {
  slug: "refund",
  path: "/legal/refund",
  title: "Tuition, Payment & Refund Policy",
  lead: "How monthly tuition, payments and refunds work.",
  description:
    "How monthly tuition, payments and refunds work at Ilm-Ul-Quran USA: the free first month, billing on the 1st, failed payments, pausing or stopping, and refunds.",
  // The cutover date (owner, 26 Nov 2026): the billing-day corrections below go live with the new site.
  updated: PENDING,
  status: "live",
  source: { wpId: 1366, url: "https://ilmulquranus.org/tuition-refund-policy/", updated: "16 Nov 2026" },
  intro: [
    {
      type: "p",
      text: `Ilm-Ul-Quran USA is operated by AL HASANAH FOUNDATION, a 501(c)(3) nonprofit organization (EIN 93-3902300) based in Richardson, Texas. This policy explains how monthly tuition is charged, what happens if a payment does not go through, and when we give refunds. If anything is unclear, please write to us at ${EMAIL}.`,
    },
  ],
  sections: [
    {
      id: "tuition",
      title: "1. Tuition",
      blocks: [
        {
          type: "list",
          items: [
            { text: "Tuition is charged monthly and paid in advance for the month ahead." },
            {
              text: "The amount depends on the course and the number of classes each week. It is shown when you enroll and on your private billing page.",
            },
            { text: "Families supported by our Zakat Fund or with an agreed reduced fee see that amount on their billing page and receipts." },
            { text: "**No child's place is ever affected by cost.** If the fee is a burden for your family, please talk to us before missing a payment." },
          ],
        },
      ],
    },
    {
      id: "first-month-free",
      title: "2. First month free for new students",
      blocks: [
        {
          type: "p",
          text: `New students study their first month free. ${K1} Your first payment is taken on the first 1st of the month on or after the day your free month ends, and you receive an email reminder before that date. If you decide not to continue, tell us before the free month ends and nothing is charged.`,
          change: {
            status: "live",
            kind: "edit",
            label: "First payment on the first 1st after the free month",
            old: "The first payment is taken when the free month ends, and you receive an email reminder before that date.",
            reason: `${BILLING_REASON} PLUGIN-INVENTORY §4.2: the first charge is the first billing day on or after the end of the 30-day free month.`,
          },
        },
      ],
    },
    {
      id: "billing-on-the-1st",
      title: "3. Billing on the 1st",
      titleChange: {
        status: "live",
        kind: "edit",
        label: "Heading: Your billing date → Billing on the 1st",
        old: "3. Your billing date",
        reason: BILLING_REASON,
      },
      blocks: [
        {
          type: "list",
          items: [
            {
              text: `${K1} It is charged automatically, on the same day for every family. Students who already study with us are charged on the 1st too.`,
              change: {
                status: "live",
                kind: "edit",
                label: "Everyone is charged on the 1st",
                old: "Tuition is charged automatically on the same date every month: your billing date. For new students it is the day the free month ends; for current students it is their usual monthly due date.",
                reason: BILLING_REASON,
              },
            },
            {
              text: "If another date suits your family better, for example close to your payday such as the 1st or the 15th of the month, tell us and we will move it. Moving the date never charges you twice for the same month.",
              change: {
                status: "live",
                kind: "remove",
                label: "Removed: moving the billing date",
                old: "If another date suits your family better, for example close to your payday such as the 1st or the 15th of the month, tell us and we will move it. Moving the date never charges you twice for the same month.",
                reason: `${BILLING_REASON} There is no per-family billing date to move.`,
              },
            },
            {
              text: "If your billing date is the 29th, 30th or 31st, in shorter months you are charged on the last day of the month.",
              change: {
                status: "live",
                kind: "remove",
                label: "Removed: the 29th–31st rule",
                old: "If your billing date is the 29th, 30th or 31st, in shorter months you are charged on the last day of the month.",
                reason: `${BILLING_REASON} Billing on the 1st makes this rule unnecessary.`,
              },
            },
          ],
        },
      ],
    },
    {
      id: "how-payments-are-taken",
      title: "4. How payments are taken",
      blocks: [
        {
          type: "list",
          items: [
            {
              text: "Payments are processed securely by Stripe. You can pay from a US bank account (ACH Direct Debit) or by debit or credit card. Ilm-Ul-Quran USA never sees or stores your full card or bank details.",
            },
            {
              text: "You add your bank account or card once, on the private link we send you. After that, tuition is taken automatically on the 1st of each month.",
              change: {
                status: "live",
                kind: "edit",
                label: "“on your billing date” → “on the 1st of each month”",
                old: "… After that, tuition is taken automatically on your billing date.",
                reason: BILLING_REASON,
              },
            },
            {
              text: "If your bank account or card is added after the 1st, or within 48 hours of it, the month you missed is charged together with the next month, in one payment on the next 1st.",
              change: {
                status: "live",
                kind: "edit",
                label: "Late card: earlier month + current month on the next 1st",
                old: "If your bank account or card is added after your billing date, the month you missed is charged together with the next month, in one payment on your next billing date.",
                reason: `${BILLING_REASON} PLUGIN-INVENTORY §4.5: the next billing day charges at most one earlier month with the current one; a cause is a card added after (or within 48 hours of) the billing day.`,
              },
            },
            {
              text: "Bank (ACH) payments can take up to 4 business days to complete, so please keep the amount available in your account on the 1st. Card payments complete straight away.",
              change: {
                status: "live",
                kind: "edit",
                label: "“on your billing date” → “on the 1st”",
                old: "… so please keep the amount available in your account on your billing date. …",
                reason: BILLING_REASON,
              },
            },
            { text: "A receipt is emailed after every payment. Your payment history and receipts are always on your private billing page." },
            { text: "On your bank or card statement the charge appears as **ILMULQURANUSA TUITION**." },
          ],
        },
      ],
    },
    {
      id: "if-a-payment-does-not-go-through",
      title: "5. If a payment does not go through",
      blocks: [
        {
          type: "list",
          items: [
            { text: "You receive an email straight away explaining what happened and how to update your bank account or card." },
            { text: "The payment is tried again automatically over the following days, at times when it is most likely to go through." },
            { text: "You can pay at any time from your private billing page, or switch to a different card or bank account there." },
            { text: "Classes continue while we sort it out together. If all attempts fail, our team contacts you personally." },
            {
              text: "If a month is still unpaid on the next 1st, that month and the new month are charged together on that day, in one payment. We never charge more than one earlier month this way: if more is owed, our team contacts you. In some cases our team can waive an unpaid earlier month. If paying both at once is difficult for your family, please talk to us.",
              change: {
                status: "live",
                kind: "edit",
                label: "Arrears: at most one earlier month on the next 1st; admin waiver",
                old: "If a month is still unpaid on your next billing date, that month and the new month are charged together on that date, in one payment. If paying both at once is difficult for your family, please talk to us.",
                reason: `${BILLING_REASON} PLUGIN-INVENTORY §4.5: at most one earlier month is charged with the current one, older owed months go to the team, and named refund admins can waive a month (with a reason).`,
              },
            },
            { text: "We do not charge late fees." },
          ],
        },
      ],
    },
    {
      id: "changing-classes-or-courses",
      title: "6. Changing classes or courses",
      blocks: [
        {
          type: "p",
          text: "If you change the course or the number of classes each week, the new monthly amount starts from the next 1st. We confirm the new amount with you before it changes.",
          change: {
            status: "live",
            kind: "edit",
            label: "“from your next billing date” → “from the next 1st”",
            old: "… the new monthly amount starts from your next billing date. …",
            reason: BILLING_REASON,
          },
        },
      ],
    },
    {
      id: "pausing-or-stopping-classes",
      title: "7. Pausing or stopping classes",
      blocks: [
        {
          type: "list",
          items: [
            {
              text: "To pause or stop classes, please tell us at least 7 days before the next 1st.",
              change: {
                status: "live",
                kind: "edit",
                label: "7-day notice before the next 1st",
                old: "To pause or stop classes, please tell us at least 7 days before your next billing date.",
                reason: `${BILLING_REASON} PLUGIN-INVENTORY §4.6: notify at least 7 days before the next charge.`,
              },
            },
            {
              text: "If you tell us less than 7 days before the 1st, the next month may already be charged. Classes then continue until the end of that month. If no class has taken place in that month yet and you tell us within 48 hours of the charge, we refund it in full.",
              change: {
                status: "live",
                kind: "edit",
                label: "“before your billing date” → “before the 1st”",
                old: "If you tell us less than 7 days before your billing date, the next month may already be charged. …",
                reason: `${BILLING_REASON} The 48-hour full refund is unchanged (PLUGIN-INVENTORY §4.6).`,
              },
            },
            { text: "When you stop, no further payments are taken, and classes continue until the end of the month you have already paid for." },
            {
              text: "If one child stops and their brothers or sisters continue, the same rule applies to that child: their classes continue until the end of the month already paid for, and from the next 1st the monthly amount no longer includes them.",
              change: {
                status: "live",
                kind: "edit",
                label: "“from the next billing date” → “from the next 1st”",
                old: "… and from the next billing date the monthly amount no longer includes them.",
                reason: BILLING_REASON,
              },
            },
            { text: "When you pause (for example for travel or family reasons), billing is paused too and restarts on the date we agree with you." },
            {
              text: "Monthly tuition cannot be cancelled from the payment page itself, so that our team can make sure every family is looked after before classes end.",
            },
          ],
        },
      ],
    },
    {
      id: "refunds",
      title: "8. Refunds",
      blocks: [
        {
          type: "list",
          items: [
            { text: "**Charged by mistake, or charged twice:** refunded in full." },
            { text: "**Classes cancelled by your teacher or by us and not made up:** refunded for those classes, or taken off your next month if you prefer." },
            {
              text: "**Stopping during a month:** tuition for a month that has already been charged is not refunded, and classes continue until the end of that month. If you tell us within 48 hours of the charge and no class has taken place in that month yet, we refund it in full.",
            },
            { text: "**New students in the free month:** nothing is charged if you tell us before the free month ends." },
            {
              text: "We reply to refund requests within 3 business days and process approved refunds within 5 business days. Refunds go back to the card or bank account that was charged and usually appear within 5 to 10 business days.",
            },
            { text: `To ask for a refund, email ${EMAIL} with the student's name.` },
          ],
        },
      ],
    },
    {
      id: "questions-about-a-charge",
      title: "9. Questions about a charge",
      blocks: [
        {
          type: "p",
          text: "If you see a charge you do not recognize or think is wrong, please contact us first. We can usually explain or correct it the same day, which is faster for you than a dispute through your bank.",
        },
      ],
    },
    {
      id: "changes",
      title: "10. Changes to fees or to this policy",
      blocks: [
        { type: "p", text: "We tell families at least 30 days before any change to tuition fees. Changes to this policy are posted on this page with a new date." },
      ],
    },
    {
      id: "contact",
      title: "11. Contact",
      blocks: [
        {
          type: "lines",
          lines: [
            "Ilm-Ul-Quran USA, operated by AL HASANAH FOUNDATION",
            "Richardson, Texas",
            `Email: ${EMAIL}`,
            "Website: [ilmulquranus.org](https://ilmulquranus.org)",
            "Related: [Terms and Conditions](/legal/terms) · [Privacy Policy](/legal/privacy)",
          ],
        },
      ],
    },
  ],
};

/* ── Accessibility statement (no live page: a draft for the owner) ────────── */

const contactLines = [
  site.email ? `Email: [${site.email}](mailto:${site.email})` : `Email: ${PENDING}`,
  site.phone ? `Phone: [${site.phone.display}](${site.phone.href})` : `Phone: ${PENDING}`,
  site.whatsapp ? `WhatsApp: [${site.whatsapp.display}](${site.whatsapp.href})` : `WhatsApp: ${PENDING}`,
  "Or use our [contact form](/contact).",
];

/**
 * No live equivalent. A draft that makes no conformance claim: it states the
 * goal and how to report a problem (contact details from site.ts). Listed by
 * content:check until the owner approves it.
 */
export const accessibilityStatement: LegalDoc = {
  slug: "accessibility",
  path: "/legal/accessibility",
  title: "Accessibility statement",
  lead: "Our goal for this website, and how to tell us about a problem.",
  description:
    "Ilm-Ul-Quran USA wants every family to be able to use this website. Our accessibility goal, the services we do not control, and how to report a problem.",
  updated: PENDING,
  status: "draft",
  source: null,
  intro: [
    {
      type: "p",
      text: "We want every family, student and teacher to be able to use this website, including people who use a screen reader, a keyboard, voice control or a magnifier.",
    },
  ],
  sections: [
    {
      id: "our-goal",
      title: "Our goal",
      blocks: [
        {
          type: "p",
          text: "We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. This is a goal we are working towards, not a statement that every page meets it.",
        },
        { type: "p", text: "Some of the ways we work towards it:" },
        {
          type: "list",
          items: [
            { text: "We build pages to work with a keyboard alone, with a visible outline on the item that has focus." },
            { text: "We never stop you from zooming in." },
            { text: "We write in plain language, with labels that stay visible on every form field." },
            { text: "We show every class time with its time zone." },
            { text: "Animations stay still when your device asks for reduced motion." },
          ],
        },
      ],
    },
    {
      id: "parts-we-do-not-control",
      title: "Parts we do not control",
      blocks: [
        {
          type: "p",
          text: "Some steps happen on other services: card and bank details are entered on Stripe's page, donations are made through Zeffy, and classes take place on Zoom. Each of these services publishes its own accessibility information. Some pages, such as donations and some payment pages, are still on our previous website while they move here.",
        },
      ],
    },
    {
      id: "tell-us-about-a-problem",
      title: "Tell us about a problem",
      blocks: [
        {
          type: "p",
          text: "If something on this website is hard to use, or you need information in another format, please tell us. Let us know the page and what went wrong, and we will do our best to help you another way while we fix it.",
        },
        { type: "lines", lines: contactLines },
      ],
    },
    {
      id: "changes",
      title: "Changes to this statement",
      blocks: [{ type: "p", text: "We post the date of each update at the top of this page." }],
    },
  ],
};

/** True when any block or item carries a change still waiting for approval. */
export function hasDraftChanges(doc: LegalDoc): boolean {
  const changes = doc.sections.flatMap((s) => [
    s.titleChange,
    ...s.blocks.flatMap((b) => (b.type === "list" ? b.items.map((i) => i.change) : b.type === "p" ? [b.change] : [])),
  ]);
  return changes.some((c) => c?.status === "draft");
}
