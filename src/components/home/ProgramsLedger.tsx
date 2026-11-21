import type { ReactNode } from "react";
import { Amount, PriceList, PriceRow as Row, TextLink } from "@/components/course/PriceList";
import { programsSection as copy } from "@/content/home";
import { courseById, fromPrice, programs, usd } from "@/content/pricing";

/**
 * Home §3 · Programs for every stage (spec §7.1; owner decision 19 Nov 2026).
 * A prospectus price list rather than a card grid: every course is one row
 * and one link to its page, with the course name in serif, its days line,
 * and the price set right in tabular figures. No filter chips on Home and no
 * images (no course photography exists; never stock). Prices come only from
 * src/content/pricing.ts.
 *
 * Home lists five only, in the owner's order (20 Nov 2026): the courses in
 * programsSection.courseIds, then the Weekend and Summer programs. The rest
 * of the catalog is behind "See all courses".
 */
const homeCourses = copy.courseIds.map(courseById);

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
              <li>
                <TextLink {...copy.scholarshipLink} />
              </li>
              {/* From lg the left column sits beside the list; below lg it sits above it, so
                  "See all courses" moves under the list (critique P2, owner 20 Nov 2026). */}
              <li className="hidden lg:block">
                <TextLink {...copy.allCourses} />
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-10 lg:col-span-8">
            <Group label={copy.monthlyLabel}>
              {homeCourses.map((course) => (
                <Row
                  key={course.id}
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
            <p className="-mt-6 lg:hidden">
              <TextLink {...copy.allCourses} />
            </p>
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
      <PriceList labelledBy={id} className="mt-3">
        {children}
      </PriceList>
    </div>
  );
}
