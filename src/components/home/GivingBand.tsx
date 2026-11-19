import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GirihLattice } from "@/components/ui/GirihLattice";
import { giving } from "@/content/home";
import { site } from "@/content/site";

/**
 * Home §8 · Nonprofit band (spec §7.1). The only place Home asks for support
 * (owner decision 19 Nov 2026); everywhere else Donate is a text link.
 * --surface-2 ground (DESIGN.md §1, which wins over the spec's --surface)
 * with the girih lattice at 4%. The strongest fact is the headline. The tax
 * ID sits next to the ask (PRODUCT.md "Brand Commitments"). Both actions are
 * --link text links, never a filled button competing with enrolment.
 */
export function GivingBand() {
  return (
    <section aria-labelledby="giving-title" className="relative isolate overflow-hidden bg-surface-2">
      <GirihLattice className="-z-10 text-ink opacity-4" />
      <div className="container-content grid gap-8 py-12 md:py-16 lg:grid-cols-12 lg:gap-6 lg:py-24">
        <h2
          id="giving-title"
          className="text-display-md text-balance md:text-display-lg lg:col-span-7"
        >
          {giving.heading}
        </h2>
        <div className="lg:col-span-5 lg:pt-3">
          <p className="max-w-measure text-body-lg text-pretty text-ink-body">
            <span translate="no">{site.name}</span> {giving.bodyJoin} <span translate="no">{site.legalName}</span>
            {giving.bodyRest}
          </p>
          <p className="mt-4 text-ui font-medium text-ink tabular-nums">{giving.legal}</p>
          <ul className="mt-6 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {giving.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
                >
                  {link.label}
                  <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
