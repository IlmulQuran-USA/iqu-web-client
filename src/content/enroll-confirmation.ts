/**
 * Links that spec §7.17 asks for on /enroll/confirmation but that do not exist
 * yet: the live site has neither (checked 25 Nov 2026; only the wa.me contact
 * link from IQU_CONTACT_WHATSAPP, which is `site.whatsapp`). They are not
 * rendered, and no placeholder is shown, until the owner supplies them;
 * `npm run content:check` lists them as pending.
 */
export const confirmationLinks = {
  whatsappGroup: { status: "pending", label: "WhatsApp group link for enrolled families (spec §7.17)", href: null },
  parentGuide: { status: "pending", label: "Parent guide link (spec §7.17)", href: null },
} as const;
