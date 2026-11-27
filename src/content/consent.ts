/*
 * Cookie banner and settings (owner brief, 27 Nov 2026: parity with the live
 * Complianz banner, "Own Banner" v78, read-only via Novamira). Category names
 * and descriptions follow the live banner's own texts; the rules are in
 * src/lib/consent.ts. Sentence case, as everywhere on the site.
 *
 * The live banner showed only "Accept" (Decline and the categories were
 * hidden by its CSS) and closed itself on scroll or after 10 seconds. The new
 * banner gives Accept all and Decline equal weight, and never closes by itself.
 */

export const consentCopy = {
  banner: {
    title: "Your privacy choices",
    /** Shown where analytics runs until the visitor declines (opt-out regions, no Global Privacy Control). */
    messageOptOut:
      "Ilm-Ul-Quran USA uses cookies to keep the site running and analytics cookies to see which pages families use, so we can improve our classes. Marketing cookies stay off unless you accept them.",
    /** Shown where nothing beyond the basics runs before a choice. */
    messageOptIn:
      "Ilm-Ul-Quran USA uses cookies to keep the site running. With your permission, we also use analytics cookies to see which pages families use, and marketing cookies to measure our outreach.",
    policy: { label: "Privacy Policy", href: "/legal/privacy#cookies" },
    accept: "Accept all",
    decline: "Decline",
    settings: "Choose cookies",
  },
  dialog: {
    title: "Cookie settings",
    intro: "Choose which cookies we may use. You can change this at any time from “Cookie settings” at the bottom of every page.",
    close: "Close cookie settings",
    save: "Save choices",
    accept: "Accept all",
    decline: "Decline all",
    saved: "Your cookie choices are saved.",
  },
  categories: [
    {
      id: "functional",
      title: "Functional",
      always: "Always on",
      // Live functional_text, with what the new site actually keeps.
      text: "Needed for the site to work: they keep our forms safe from spam (Google reCAPTCHA), remember your enrollment answers on this device, and save your cookie choices. They cannot be switched off.",
    },
    {
      id: "statistics",
      title: "Analytics",
      // Live statistics_text_anonymous.
      text: "Analytics cookies help us understand which pages families visit most, so we can make enrollment simpler and improve our course pages.",
      tools: "Google Analytics",
    },
    {
      id: "marketing",
      title: "Marketing",
      // Live marketing_text.
      text: "Marketing cookies let us show our Quran programs to families who may benefit from them, and help us understand which of our outreach efforts actually reach the right people.",
      tools: "Meta Pixel (Facebook and Instagram); with this on, our server also tells Meta when an enrollment is sent",
    },
  ],
  /** The footer link that reopens the settings (legal strip). */
  footerLink: "Cookie settings",
} as const;
