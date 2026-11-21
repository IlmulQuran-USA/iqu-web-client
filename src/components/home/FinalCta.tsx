import { ButtonLink } from "@/components/ui/Button";
import { finalCta } from "@/content/home";

/** The StickyCTA hides when this band arrives, so only one filled button is in view. */
export const FINAL_CTA_ID = "final-cta";

/**
 * Home §10 · Final call to action (spec §7.1; copy approved 19 Nov 2026).
 * Full-width --band: one headline, one button (the band variant, coral fill),
 * one line of reassurance consistent with PRODUCT.md decision 4.
 *
 * `copy` replaces the monthly-course wording where the free month does not
 * apply (the programs view of the catalog; programsCta in src/content/catalog.ts).
 */
export type FinalCtaCopy = { heading: string; button: { label: string; href: string }; reassurance: string };

export function FinalCta({ href, copy = finalCta }: { href?: string; copy?: FinalCtaCopy } = {}) {
  return (
    <section id={FINAL_CTA_ID} aria-labelledby="final-cta-title" className="band">
      <div className="container-content flex flex-col items-center py-16 text-center md:py-20 lg:py-24">
        <h2 id="final-cta-title" className="text-display-md text-balance md:text-display-lg">
          {copy.heading}
        </h2>
        <ButtonLink href={href ?? copy.button.href} variant="band" size="lg" className="mt-8 w-full sm:w-auto">
          {copy.button.label}
        </ButtonLink>
        <p className="mt-4 text-body text-on-band-muted">{copy.reassurance}</p>
      </div>
    </section>
  );
}
