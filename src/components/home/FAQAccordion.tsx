import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { faq } from "@/content/home";
import { PENDING, site } from "@/content/site";
import { cn } from "@/lib/cn";

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
        {/* DOM order is heading, questions, contact, so on phones the questions come
            first (critique, owner 20 Nov 2026). From lg the grid puts the contact
            block back under the heading, beside the questions. */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-4">
          <h2 id="faq-title" className="text-heading-xl md:text-display-md lg:col-span-4 lg:row-start-1">
            {faq.heading}
          </h2>
          <FAQList items={faq.items} className="lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-1 lg:self-start" />
          <div className="lg:col-span-4 lg:row-start-2">
            <p className="max-w-measure text-body text-ink-body">Something else on your mind? Ask us directly.</p>
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
        </div>
      </div>
    </section>
  );
}

export type FAQItem = {
  q: string;
  a: string;
  /** A short list after the answer (the cost answer's prices). */
  points?: readonly string[];
  /** A closing line after the list. */
  after?: string;
};

/**
 * The accordion itself: native <details>, one per question, between hairlines.
 * Shared by Home §9 and the course pages.
 */
export function FAQList({ items, className }: { items: readonly FAQItem[]; className?: string }) {
  return (
    <div className={cn("border-t border-ink", className)}>
      {items.map((item) => (
        <details key={item.q} className="group border-b border-rule">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-chip py-4 text-body-lg font-medium text-ink [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-5 shrink-0 text-ink-muted transition-transform duration-(--duration-default) ease-riwaq group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="flex max-w-measure flex-col gap-3 pb-6 text-body text-pretty text-ink-body">
            <p>{item.a}</p>
            {item.points ? (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-muted">
                {item.points.map((point) => (
                  <li key={point} className="tabular-nums">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            {item.after ? <p>{item.after}</p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
