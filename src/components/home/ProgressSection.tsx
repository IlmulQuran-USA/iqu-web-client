import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { progressSection as copy } from "@/content/home";

/**
 * Home §6 · How progress is measured (spec §7.1 section 6; owner, 20 Nov
 * 2026). There is no parent portal yet, so no dashboard and no report
 * promises: the real checkpoints written into each course (COURSE-CONTENT.md),
 * set as a price-list-style ledger whose rows open the course's curriculum,
 * then the published Summer Ilm Camp 2026 results as proof.
 *
 * DOM order is heading, ledger, proof. From lg the grid places the proof
 * card under the heading, beside the ledger (critique, 20 Nov 2026).
 */
export function ProgressSection() {
  const { proof } = copy;
  return (
    <section aria-labelledby="progress-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12">
          <h2
            id="progress-title"
            className="text-heading-xl text-balance md:text-display-md lg:col-span-4 lg:row-start-1"
          >
            {copy.heading}
          </h2>

          <ul className="border-t border-ink lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-1 lg:self-start">
            {copy.rows.map((row) => (
              <li key={row.label} className="border-b border-rule">
                {row.href ? (
                  <Link
                    href={row.href}
                    className="group -mx-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-card px-3 py-4 transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2 sm:grid-cols-[14rem_1fr_auto] sm:items-baseline sm:gap-x-6 sm:py-5"
                  >
                    <Label text={row.label} link />
                    <span className="col-start-1 text-body text-pretty text-ink-body sm:col-start-2">{row.text}</span>
                    {/* A tap cue at every width; the plain "Every course" row has none. */}
                    <ArrowRight
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="col-start-2 row-span-2 row-start-1 size-5 self-center text-ink-muted transition-transform duration-(--duration-micro) ease-riwaq group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none sm:col-start-3 sm:row-span-1"
                    />
                  </Link>
                ) : (
                  <div className="grid gap-y-1 py-4 sm:grid-cols-[14rem_1fr_auto] sm:items-baseline sm:gap-x-6 sm:py-5">
                    <Label text={row.label} />
                    <span className="text-body text-pretty text-ink-body">{row.text}</span>
                    <span aria-hidden="true" className="hidden w-5 sm:block" />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Proof: the published results. Off-site until /results/summer-2026 exists. */}
          <div className="self-start rounded-card bg-surface-2 p-5 sm:p-6 lg:col-span-4 lg:row-start-2">
            <p className="font-display text-heading-md font-semibold text-balance text-ink">{proof.title}</p>
            <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">{proof.text}</p>
            <a
              href={proof.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
            >
              {proof.link.label}
              <ArrowUpRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Label({ text, link = false }: { text: string; link?: boolean }) {
  return (
    <span
      className={
        "font-display text-heading-md font-semibold text-balance text-ink" +
        (link ? " decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline" : "")
      }
    >
      {text}
    </span>
  );
}
