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
  taxStatus: "501(c)(3) nonprofit",
  ein: "93-3902300",
  address: {
    line1: "100 N Central Expy Suite 914",
    line2: "Richardson, TX 75080",
  },
  // Supplied by the owner, 19 Nov 2026.
  phone: { display: "+1 (214) 529-3544", href: "tel:+12145293544" } as { display: string; href: string } | null,
  email: "info@ilmulquranus.org" as string | null,
} as const;

export const PENDING = "[pending]";
