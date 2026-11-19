import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { programsSection as copy } from "@/content/home";
import { fromPrice, monthlyCourses, programs, usd } from "@/content/pricing";

/**
 * Home §3 · Programs for every stage (spec §7.1; owner decision 19 Nov 2026).
 * A prospectus price list rather than a card grid: every course is one row
 * and one link to its page, with the course name in serif, its days line,
 * and the price set right in tabular figures. No filter chips on Home and no
 * images (no course photography exists; never stock). Prices come only from
 * src/content/pricing.ts.
 */
export function ProgramsLedger() {
  return (
    <section aria-labelledby="programs-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <h2 id="programs-title" className="text-heading-xl text-balance md:text-display-md">
              {copy.heading}
            </h2>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">{copy.intro}</p>
            <p className="mt-6 max-w-measure text-body text-ink-body">{copy.scholarshipNote}</p>
            <ul className="mt-4 flex flex-col items-start">
              {[copy.scholarshipLink, copy.allCourses].map((link) => (
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

          <div className="flex flex-col gap-10 lg:col-span-8">
            <Group label={copy.monthlyLabel}>
              {monthlyCourses.map((course) => (
                <Row
                  key={course.key}
                  href={course.href}
                  name={course.label}
                  meta={copy.daysLine(course.minDays, course.maxDays)}
                  price={
                    <>
                      <span className="text-ui text-ink-muted">from </span>
                      <Amount>{usd(fromPrice(course))}</Amount>
                      <span className="text-ui text-ink-muted">/month</span>
                    </>
                  }
                />
              ))}
            </Group>
            <Group label={copy.programsLabel}>
              <Row
                href={programs.weekend.href}
                name={programs.weekend.label}
                meta={copy.weekendMeta}
                price={<Amount>Free</Amount>}
              />
              <Row
                href={programs.summer.href}
                name={programs.summer.label}
                meta={copy.summerMeta}
                price={
                  <>
                    <Amount>{copy.summerPrice}</Amount>
                    <span className="block text-ui text-ink-muted">{copy.summerPriceNote}</span>
                  </>
                }
              />
            </Group>
          </div>
        </div>
      </div>
    </section>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const id = `programs-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <h3 id={id} className="font-sans text-ui font-medium text-ink-muted">
        {label}
      </h3>
      <ul aria-labelledby={id} className="mt-3 border-t border-ink">
        {children}
      </ul>
    </div>
  );
}

/**
 * One course: the whole row is the link. Hover tints the row (--surface-2),
 * underlines the name and nudges the arrow; focus draws the global ring.
 */
function Row({ href, name, meta, price }: { href: string; name: string; meta: string; price: ReactNode }) {
  return (
    <li className="border-b border-rule">
      <Link
        href={href}
        className="group -mx-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-card px-3 py-4 transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2 sm:grid-cols-[1fr_auto_auto] sm:gap-x-6 sm:py-5"
      >
        <span className="min-w-0">
          <span className="block font-display text-heading-md font-semibold text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline sm:text-heading-lg">
            {name}
          </span>
          <span className="mt-1 block text-ui text-ink-muted">{meta}</span>
        </span>
        <span className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1 sm:text-right">{price}</span>
        <ArrowRight
          aria-hidden="true"
          strokeWidth={1.5}
          className="col-start-2 row-span-2 row-start-1 size-5 text-ink-muted transition-transform sm:col-start-3 sm:row-span-1 duration-(--duration-micro) ease-riwaq group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none"
        />
      </Link>
    </li>
  );
}

function Amount({ children }: { children: ReactNode }) {
  return <span className="font-display text-heading-md font-semibold text-ink tabular-nums sm:text-heading-lg">{children}</span>;
}
