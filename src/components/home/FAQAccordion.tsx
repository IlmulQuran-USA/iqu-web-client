import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { faq } from "@/content/home";
import { PENDING, site } from "@/content/site";

/**
 * FAQAccordion (spec §6.3) · Home §9 Common questions. Native <details>, so
 * it works without JavaScript and keeps keyboard and screen-reader behaviour
 * for free. The answers are owner-review drafts (src/content/home.ts); no
 * FAQPage structured data until they are approved.
 */
const contactLink =
  "inline-flex min-h-11 items-center rounded-chip text-link underline decoration-1 underline-offset-2 hov:decoration-2";

export function FAQAccordion() {
  return (
    <section aria-labelledby="faq-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <h2 id="faq-title" className="text-heading-xl md:text-display-md">
              {faq.heading}
            </h2>
            <p className="mt-4 max-w-measure text-body text-ink-body">Something else on your mind? Ask us directly.</p>
            {/* Contact links are full 44 px targets (CLAUDE.md §4) and never break mid-number. */}
            <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 text-body">
              <dt className="text-ink-muted">Phone</dt>
              <dd>
                {site.phone ? (
                  <a href={site.phone.href} className={contactLink + " tabular-nums whitespace-nowrap"}>
                    {site.phone.display}
                  </a>
                ) : (
                  <span>{PENDING}</span>
                )}
              </dd>
              <dt className="text-ink-muted">Email</dt>
              <dd className="min-w-0">
                {site.email ? (
                  <a href={`mailto:${site.email}`} className={contactLink + " break-all"}>
                    {site.email}
                  </a>
                ) : (
                  <span>{PENDING}</span>
                )}
              </dd>
            </dl>
            <Link
              href={faq.all.href}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
            >
              {faq.all.label}
              <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Link>
          </div>

          <div className="border-t border-ink lg:col-span-8">
            {faq.items.map((item) => (
              <details key={item.q} className="group border-b border-rule">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-chip py-4 text-body-lg font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="size-5 shrink-0 text-ink-muted transition-transform duration-(--duration-default) ease-riwaq group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-measure pb-6 text-body text-pretty text-ink-body">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
