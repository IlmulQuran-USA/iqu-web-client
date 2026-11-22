import Link from "next/link";
import type { ReactNode } from "react";
import { RevealItem } from "@/components/motion/Reveal";
import { familiesSection as copy } from "@/content/home";
import { initialsOf } from "@/lib/arch";
import { homeTestimonialIds, programOf, testimonialsById, type Testimonial } from "@/content/testimonials";

/**
 * Home §7 · What families say (spec §7.1 section 7; owner, 20 Nov 2026).
 * Three of the six, chosen for variety (program and place); live and sample
 * both render (owner, 21 Nov 2026: shown for admin review, replace or confirm
 * before launch). With none, the section is left out, never an empty state.
 * At most three, as a static row (no carousel), stacked on phones. Each is the
 * family's exact words, their initials (no photos), name, place and the
 * program it is about. No star ratings, titles or review counts.
 */
export function FamiliesSection({ items = testimonialsById(homeTestimonialIds) }: { items?: Testimonial[] }) {
  const shown = items.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="families-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <h2 id="families-title" className="text-heading-xl text-balance md:text-display-md">
          {copy.heading}
        </h2>
        <ul className="mt-8 grid gap-10 md:mt-10 md:grid-cols-3 md:gap-6">
          {shown.map((t) => (
            <RevealItem as="li" key={t.id}>
              <Quote t={t} />
            </RevealItem>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Quote({ t }: { t: Testimonial }) {
  const program = programOf(t);
  return (
    <figure className="flex h-full flex-col border-t border-ink pt-5">
      <blockquote className="flex-1 text-body-lg text-pretty text-ink">
        <p>“{keepName(t.quote)}”</p>
      </blockquote>
      <figcaption className="mt-6 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface font-display text-body font-semibold text-ink-body"
        >
          {initialsOf(t.name)}
        </span>
        <span className="min-w-0 text-ui">
          <span className="block font-medium text-ink" translate="no">
            {t.name}
          </span>
          <span className="block text-ink-muted">{t.place}</span>
          {/* The program on its own line, so its 44 px target never pushes the place away from the name. */}
          <Link
            href={program.href}
            className="-my-1.5 inline-flex min-h-11 items-center rounded-chip text-link underline decoration-1 underline-offset-2 hov:decoration-2"
          >
            {program.label}
          </Link>
        </span>
      </figcaption>
    </figure>
  );
}

const ORG = "Ilm-Ul-Quran USA";

/** The family's exact words, with the organisation's name kept on one line (it never breaks at its hyphens). */
function keepName(quote: string): ReactNode[] {
  return quote.split(ORG).flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key={i} className="whitespace-nowrap" translate="no">
            {ORG}
          </span>,
          part,
        ],
  );
}
