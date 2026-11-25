/**
 * Organisation facts shown in the header, footer and metadata.
 * Sources: spec §6.2, PRODUCT.md "Brand Commitments".
 * `null` means not yet supplied (spec §8). Components render a [pending]
 * marker for these and never invent a value.
 */
export const site = {
  name: "Ilm-Ul-Quran USA",
  legalName: "AL HASANAH FOUNDATION",
  domain: "ilmulquranus.org",
  mission:
    "Live Quran and Islamic classes taught by qualified Huffaz, Ulama and Mufti, for families in the United States and Canada.",
  /** Footer brand description (live text; owner, 21 Nov 2026). The metadata keeps `mission`. */
  footerLine: "Live Quran and Islamic classes with qualified Huffaz, Ulama and Mufti, for families in the United States and Canada.",
  /**
   * Footer mission line: the live About page mission (CONTENT-ADDENDUM.md §1),
   * its first clause only (owner, 21 Nov 2026).
   */
  missionLine: { label: "Our mission:", text: "to spread the light of Quranic knowledge across the United States and Canada." },
  taxStatus: "501(c)(3) nonprofit",
  ein: "93-3902300",
  address: {
    line1: "100 N Central Expy Suite 914",
    line2: "Richardson, TX 75080",
    // The same address in parts, for structured data. Keep in step with line2.
    locality: "Richardson",
    region: "TX",
    postalCode: "75080",
    country: "US",
  },
  // Supplied by the owner, 19 Nov 2026; confirmed 22 Nov 2026 (PRODUCT.md K2, closed). The
  // (214) 662-1591 on the live About page is outdated: never use it.
  phone: { display: "+1 (214) 529-3544", href: "tel:+12145293544" } as { display: string; href: string } | null,
  email: "info@ilmulquranus.org" as string | null,
  // The live plugin's family contact number: wp-config IQU_CONTACT_WHATSAPP, shown and linked as in
  // iqu-registration includes/class-iqu-contact.php:21-43 (read-only, 25 Nov 2026). A public business number.
  whatsapp: { display: "+1 (469) 275-6450", href: "https://wa.me/14692756450" } as { display: string; href: string } | null,
} as const;

export const PENDING = "[pending]";
