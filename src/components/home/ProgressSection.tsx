import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { progressSection as copy } from "@/content/home";

/**
 * Home §6 · How progress is measured (spec §7.1 section 6; owner, 20–21 Nov
 * 2026). The real checkpoints written into each course (COURSE-CONTENT.md)
 * as a price-list-style ledger whose rows open the course's curriculum; the
 * parent dashboard (screenshots of /preview/parent-dashboard, sample data)
 * in a laptop frame with the phone overlapping it, captioned in words, with
 * "See a sample report"; and the published Summer Ilm Camp 2026 results.
 *
 * Order (DOM, and so phones): heading and lead, ledger, dashboard, results.
 * From lg: heading, ledger and results on the left; the dashboard on the
 * right. Below sm only the phone screenshot shows, at a readable size.
 * The secondary button keeps the one-filled-button rule.
 */
export function ProgressSection() {
  const { proof, dashboard } = copy;
  return (
    <section aria-labelledby="progress-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <div className="lg:col-start-1 lg:row-start-1">
            <h2 id="progress-title" className="text-heading-xl text-balance md:text-display-md">
              {copy.heading}
            </h2>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">{copy.lead}</p>
          </div>

          <ul className="border-t border-ink lg:col-start-1 lg:row-start-2">
            {copy.rows.map((row) => (
              <li key={row.label} className="border-b border-rule">
                {row.href ? (
                  <Link
                    href={row.href}
                    className="group -mx-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-card px-3 py-4 transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
                  >
                    <Label text={row.label} link />
                    <span className="col-start-1 text-body text-pretty text-ink-body">{row.text}</span>
                    {/* A tap cue at every width; the plain "Every course" row has none. */}
                    <ArrowRight
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="col-start-2 row-span-2 row-start-1 size-5 self-center text-ink-muted transition-transform duration-(--duration-micro) ease-riwaq group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none"
                    />
                  </Link>
                ) : (
                  <div className="grid gap-y-1 py-4">
                    <Label text={row.label} />
                    <span className="text-body text-pretty text-ink-body">{row.text}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* The parent dashboard: laptop with the phone over its lower right corner (phone only below sm). */}
          <figure className="flex flex-col gap-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:pt-2">
            <div className="relative mx-auto w-3/5 sm:hidden">
              <PhoneFrame />
            </div>
            <div className="relative hidden pr-[8%] pb-[18%] sm:block">
              {/* Laptop: a dark bezel around the screen, then the base. Radii and elevation from the token set. */}
              <div className="rounded-t-card bg-ink p-[1.6%] pb-[2.2%] shadow-card">
                <Image
                  src={dashboard.desktop.src}
                  width={dashboard.desktop.width}
                  height={dashboard.desktop.height}
                  alt={dashboard.alt}
                  sizes="(min-width: 80rem) 540px, (min-width: 64rem) 42vw, 86vw"
                  loading="lazy"
                  className="h-auto w-full rounded-chip"
                />
              </div>
              <div aria-hidden="true" className="-mx-[5%] h-3.5 rounded-b-card border border-t-0 border-rule bg-surface" />
              <div className="absolute right-0 bottom-0 w-[27%]">
                <PhoneFrame decorative />
              </div>
            </div>
            <figcaption>
              <p className="text-body font-medium text-ink">{dashboard.caption}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {dashboard.callouts.map((c) => (
                  <li key={c} className="flex gap-2.5 text-body text-pretty text-ink-body">
                    <Check aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-accent-strong" />
                    {c}
                  </li>
                ))}
              </ul>
            </figcaption>
            <div>
              <ButtonLink
                href={dashboard.report.href}
                variant="secondary"
                iconEnd={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              >
                {dashboard.report.label}
              </ButtonLink>
            </div>
          </figure>

          {/* Proof: the published results. Off-site until /results/summer-2026 exists. */}
          <div className="rounded-card bg-surface-2 p-5 sm:p-6 lg:col-start-1 lg:row-start-3 lg:self-start">
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

/** The phone screenshot in a dark bezel. Decorative when the laptop beside it already carries the alt text. */
function PhoneFrame({ decorative = false }: { decorative?: boolean }) {
  const { dashboard } = copy;
  return (
    <div className="rounded-card bg-ink p-[3.5%] shadow-overlay">
      <Image
        src={dashboard.phone.src}
        width={dashboard.phone.width}
        height={dashboard.phone.height}
        alt={decorative ? "" : `${dashboard.alt} on a phone`}
        sizes="(min-width: 80rem) 160px, (min-width: 30rem) 26vw, 60vw"
        loading="lazy"
        className="h-auto w-full rounded-button"
      />
    </div>
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
