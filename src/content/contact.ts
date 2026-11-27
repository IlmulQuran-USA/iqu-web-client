import { socialLinks } from "./navigation.ts";
import { site } from "./site.ts";

/*
 * /contact (spec §7.15; plan approved by the owner, answers 1–4 yes, recorded
 * in IQU-handoff-2026-11-23.md §7.5; the form sends through the Gmail API, not
 * Brevo, per the Resolved facts of 24 Nov 2026).
 *
 * Every channel is a live fact (src/content/site.ts, navigation.ts): the phone
 * +1 (214) 529-3544 (K2), info@ilmulquranus.org, the WhatsApp number of the
 * live plugin's IQU_CONTACT_WHATSAPP, the Richardson address and Facebook.
 * The live "Mon–Fri, 8 AM–5 PM" text hours stay hidden until their time zone
 * is confirmed (CLAUDE.md: every time carries its zone label).
 */

const address = `${site.address.line1}, ${site.address.line2}`;

export const contactMeta = {
  title: "Contact us",
  description: `Call, text, WhatsApp or email ${site.name}, or send us a message. We reply by email.`,
} as const;

export const contactHeader = {
  title: "Contact us",
  // No "send a message below": the form may be closed, and on wide screens it sits beside the channels.
  intro: "Questions about classes, fees or giving? Reach us the way that suits you.",
} as const;

export type Channel = {
  id: "phone" | "email" | "whatsapp" | "address" | "facebook";
  label: string;
  value: string;
  href: string;
  /** A separate link under the value, for the office only ("Get directions"); the other values are the link. */
  action?: string;
  external?: boolean;
  /** The value can be copied with a button (the phone number). */
  copy?: boolean;
};

const facebook = socialLinks.find((s) => s.label === "Facebook");

export const channels: Channel[] = [
  ...(site.phone ? [{ id: "phone" as const, label: "Call or text", value: site.phone.display, href: site.phone.href, copy: true }] : []),
  ...(site.email ? [{ id: "email" as const, label: "Email", value: site.email, href: `mailto:${site.email}` }] : []),
  ...(site.whatsapp ? [{ id: "whatsapp" as const, label: "WhatsApp", value: site.whatsapp.display, href: site.whatsapp.href, external: true }] : []),
  {
    id: "address",
    label: "Office",
    value: address,
    href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, USA`)}`,
    action: "Get directions",
    external: true,
  },
  ...(facebook ? [{ id: "facebook" as const, label: "Facebook", value: "facebook.com/ilmulquranusa", href: facebook.href, external: true }] : []),
];

export const contactForm = {
  heading: "Send a message",
  intro: "We reply by email.",
  closed: "Message form opens soon.",
  closedHelp: "Until then, please call, text, WhatsApp or email us.",
  sent: "Thank you. We received your message and will reply by email.",
  button: "Send message",
} as const;

/** Spec §7.15 item 5: a link to the FAQ above the form, to answer common questions first. */
export const contactFaq = {
  text: "Many questions about classes, fees and billing already have an answer.",
  link: { label: "Read the FAQ", href: "/faq" },
} as const;
