import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ArchFrame } from "@/components/ui/ArchFrame";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import {
  afterClick,
  ctas,
  daysLabel,
  heroFacts,
  scholarshipLink,
  shown,
  taughtBy,
  teachersOf,
} from "@/content/course-page";
import type { Course } from "@/content/courses";
import { fromPrice, isFixedSchedule, usd } from "@/content/pricing";
import { cn } from "@/lib/cn";

/** The mobile StickyCTA appears once these buttons scroll away. */
export const COURSE_CTAS_ID = "course-ctas";
/** The header's CTA yields while the right-hand card is on screen (one filled button in view). */
export const COURSE_RAIL_ID = "course-rail";

/**
 * Course hero (spec §7.3 section 1; plan approved 20 Nov 2026). Text only:
 * no course photography or teacher video exists, and stock is never used.
 * Breadcrumb, H1, the live overview as the opening paragraph, then the fact
 * row. No level badge or age range (no source), no languages (they belong to
 * each teacher's card).
 *
 * Below lg the price and both buttons follow the facts. From lg they live
 * only in the sticky card on the right (CourseRail), so the hero never holds
 * a second filled button.
 */
export function CourseHero({ course }: { course: Course }) {
  const overview = shown(course.content.overview);
  const links = ctas(course);
  const teachers = taughtBy(course);
  return (
    <div className="pt-2 pb-10 md:pb-12">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Courses", href: "/courses" }, { label: course.label }]} />
      <h1 id="course-title" className="mt-4 text-display-md font-medium md:text-display-lg">
        {course.label}
      </h1>
      {overview ? <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{overview}</p> : null}

      {/* One line with middle dots from md; a two-column list below it, so a dot never starts a line. */}
      <ul
        aria-label="Course facts"
        className="mt-6 grid grid-cols-2 items-start gap-x-4 gap-y-2 text-ui font-medium text-ink-body md:flex md:flex-wrap md:items-center md:gap-x-0"
      >
        {heroFacts(course).map((fact, i) => (
          <li key={fact} className="flex items-center">
            {i > 0 ? (
              <span aria-hidden="true" className="hidden px-3 text-ink-muted md:inline">
                ·
              </span>
            ) : null}
            {/* Its own element: in a flex item the text's leading space would collapse. */}
            <span>{keepCompounds(fact)}</span>
          </li>
        ))}
      </ul>
      {/* "Who teaches?" is the parent's first question (PRODUCT.md Users): answered in the hero. */}
      {teachers ? <TaughtBy course={course} summary={teachers} /> : null}

      <div className="mt-6 lg:hidden">
        <Price course={course} />
        <p className="mt-1">
          <TextLink {...scholarshipLink} />
        </p>
        <div id={COURSE_CTAS_ID} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={links.enrol.href} size="lg" className="w-full sm:w-auto">
            {links.enrol.label}
          </ButtonLink>
          <ButtonLink href={links.ask.href} variant="secondary" size="lg" className="w-full sm:w-auto">
            {links.ask.label}
          </ButtonLink>
        </div>
        <p className="mt-3 max-w-measure text-ui text-pretty text-ink-muted">{afterClick}</p>
      </div>
    </div>
  );
}

/**
 * The enrolment card (spec §7.3 section 11, "Desktop: right rail card"),
 * from lg only. It sticks under the header from the hero to the FAQ, so the
 * price and the one filled button are always in reach.
 */
export function CourseRail({ course, className }: { course: Course; className?: string }) {
  const links = ctas(course);
  return (
    // Bottom padding keeps the stuck card clear of the final band (critique, owner 20 Nov 2026).
    <aside aria-labelledby="course-rail-title" className={cn("hidden lg:block lg:pb-16", className)}>
      <div
        id={COURSE_RAIL_ID}
        className="sticky top-[calc(var(--header-height)+1.5rem)] mt-16 rounded-card border border-rule bg-paper p-6 shadow-card"
      >
        <p id="course-rail-title" className="font-display text-heading-md font-semibold text-balance text-ink">
          {course.label}
        </p>
        <div className="mt-4">
          <Price course={course} />
          <p className="mt-1 text-ui text-ink-muted">{daysLabel(course)} · 30 or 45 minutes</p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href={links.enrol.href} size="lg" fullWidth>
            {links.enrol.label}
          </ButtonLink>
          <ButtonLink href={links.ask.href} variant="secondary" fullWidth>
            {links.ask.label}
          </ButtonLink>
        </div>
        <p className="mt-3 text-ui text-pretty text-ink-muted">{afterClick}</p>
        <ul className="mt-5 flex flex-col border-t border-rule pt-3">
          <li>
            <TextLink label="See every fee" href="#fees" />
          </li>
          <li>
            <TextLink {...scholarshipLink} />
          </li>
        </ul>
      </div>
    </aside>
  );
}

/** At most this many arches in the hero row; the names carry the rest. */
const HERO_TEACHERS = 3;

/**
 * "Who teaches?" in the first screen (critique, owner 20 Nov 2026): up to
 * three small arch portraits (the monogram where there is no photo), then the
 * names as text ("Taught by A, B and 4 more"), so the row reads without
 * photos. One link to the Teachers section; the arches are decorative.
 */
function TaughtBy({ course, summary }: { course: Course; summary: string }) {
  const people = teachersOf(course);
  const shownPeople = people.slice(0, HERO_TEACHERS);
  return (
    <a href="#teachers" className="group mt-6 flex min-h-11 max-w-measure items-center gap-3 rounded-chip">
      <span className="flex shrink-0 items-end gap-1.5">
        {/* A fixed-width box per arch: ArchFrame fills its container's width. */}
        {shownPeople.map((person) => (
          <span key={person.id} className="block w-10 shrink-0">
            {person.photo ? (
              <ArchFrame
                name={person.name}
                decorative
                src={person.photo.src}
                width={person.photo.width}
                height={person.photo.height}
                focalPoint={{ x: 50, y: 50 }}
                sizes="40px"
                loading="eager"
              />
            ) : (
              <ArchFrame name={person.name} decorative />
            )}
          </span>
        ))}
      </span>
      <span className="min-w-0 text-ui text-pretty text-ink-body">
        <span translate="no">{summary}</span>{" "}
        <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-link underline decoration-1 underline-offset-2 group-hover:decoration-2">
          Meet the teachers
          <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </span>
      </span>
    </a>
  );
}

function Price({ course }: { course: Course }) {
  return (
    <p className="flex items-baseline gap-1.5">
      {/* One fee only (a fixed schedule): no "From". */}
      {isFixedSchedule(course) ? null : <span className="text-ui text-ink-muted">From</span>}
      <span className="font-display text-heading-xl font-semibold text-ink tabular-nums">{usd(fromPrice(course))}</span>
      <span className="text-ui text-ink-muted">/month</span>
    </p>
  );
}

export function TextLink({ label, href, className }: { label: string; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2",
        className,
      )}
    >
      {label}
      <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
    </Link>
  );
}

/** "One-on-one" never breaks at its hyphens. */
function keepCompounds(text: string): ReactNode {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    /\S+-\S+/.test(part) ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
