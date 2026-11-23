import { CalendarClock } from "lucide-react";
import { TaughtBy, TextLink } from "@/components/course/CourseHero";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { taughtBy } from "@/content/course-page";
import type { Program } from "@/content/courses";
import {
  alternativeOf,
  askOf,
  comingSoonOf,
  enrolOf,
  hearFirst,
  heroFacts,
  leadOf,
  priceOf,
  seasonLine,
  showsLocalTime,
  timetableOf,
  whenLine,
} from "@/content/program-page";
import { currentSeason } from "@/content/program-timetable";
import { ClassTime } from "./ClassTime";
import { cn } from "@/lib/cn";

/** The mobile StickyCTA appears once this block scrolls away. */
export const PROGRAM_CTAS_ID = "program-ctas";
/** The header's CTA yields while the right-hand card is on screen. */
export const PROGRAM_RAIL_ID = "program-rail";

/**
 * Program hero (spec §7.11 section 1; plan approved 23 Nov 2026). Text and
 * the teachers' own arches: no camp photography exists, and stock is never
 * used. No countdown and no seat count: there is no real deadline or number.
 *
 * Below lg the price and the actions follow the facts; from lg they live only
 * in the sticky card (ProgramRail), so the hero never holds a second filled
 * button. Between seasons (Summer with no next-run dates) there is no enrol
 * button at all: "2027 dates coming soon" and a link to the newsletter card.
 */
export function ProgramHero({ program }: { program: Program }) {
  const teachers = taughtBy(program);
  const season = seasonLine(program);
  const soon = comingSoonOf(program);
  const t = timetableOf(program);
  return (
    <div className="pt-2 pb-10 md:pb-12">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Programs", href: "/courses?type=programs" },
          { label: program.label },
        ]}
      />
      <h1 id="program-title" className="mt-4 text-display-md font-medium text-balance md:text-display-lg">
        {program.label}
      </h1>
      <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{leadOf(program)}</p>

      {/* One line with middle dots from md; a two-column list below it, so a dot never starts a line. */}
      <ul
        aria-label="Program facts"
        className="mt-6 grid grid-cols-2 items-start gap-x-4 gap-y-2 text-ui font-medium text-ink-body md:flex md:flex-wrap md:items-center md:gap-x-0"
      >
        {heroFacts(program).map((fact, i) => (
          <li key={fact} className="flex items-center">
            {i > 0 ? (
              <span aria-hidden="true" className="hidden px-3 text-ink-muted md:inline">
                ·
              </span>
            ) : null}
            <span className="whitespace-nowrap">{fact}</span>
          </li>
        ))}
      </ul>

      {season || soon ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-ui text-ink-body">
          {season ? <p className="max-w-measure text-pretty tabular-nums">{season}</p> : null}
          {/* From lg the card on the right carries the chip, so it shows once per view. */}
          {soon ? (
            <div className="lg:hidden">
              <ComingSoonChip text={soon} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* "Will the times work for me?" answered in the first view (PRODUCT.md Users), not after scrolling. */}
      {showsLocalTime(program) ? (
        <div className="mt-4 max-w-measure">
          <ClassTime
            days={t.days}
            start={t.start}
            end={t.end}
            zone={t.zone}
            zoneName={`Central Time (${t.zoneLabel})`}
            onDate={currentSeason(t)?.start}
          />
        </div>
      ) : null}

      {teachers ? <TaughtBy course={program} summary={teachers} /> : null}

      <div className="mt-6 lg:hidden">
        <Price program={program} />
        <div id={PROGRAM_CTAS_ID} className="mt-6">
          <Actions program={program} />
        </div>
      </div>
    </div>
  );
}

/**
 * The enrolment card, from lg only (the course page's right rail, spec §7.3
 * section 11, carried over). It sticks under the header, so the price and
 * the one filled button stay in reach all the way down.
 */
export function ProgramRail({ program, className }: { program: Program; className?: string }) {
  const soon = comingSoonOf(program);
  const alternative = alternativeOf(program);
  return (
    <aside aria-labelledby="program-rail-title" className={cn("hidden lg:block lg:pb-16", className)}>
      <div
        id={PROGRAM_RAIL_ID}
        className="sticky top-[calc(var(--header-height)+1.5rem)] mt-16 rounded-card border border-rule bg-paper p-6 shadow-card"
      >
        <p id="program-rail-title" className="font-display text-heading-md font-semibold text-balance text-ink">
          {program.label}
        </p>
        <div className="mt-4">
          <Price program={program} />
          <p className="mt-1 text-ui text-pretty text-ink-muted">{whenLine(program)}</p>
        </div>
        {soon ? (
          <div className="mt-4">
            <ComingSoonChip text={soon} />
          </div>
        ) : null}
        <div className="mt-6">
          <Actions program={program} stacked />
        </div>
        <ul className="mt-5 flex flex-col border-t border-rule pt-3">
          {alternative ? (
            <li>
              <TextLink label={alternative.label} href={alternative.href} />
            </li>
          ) : null}
          {/* A free program has nothing more to say about fees than the card already does. */}
          {program.fee > 0 ? (
            <li>
              <TextLink label="Fees in full" href="#fees" />
            </li>
          ) : null}
          <li>
            <TextLink label="When it meets" href="#schedule" />
          </li>
        </ul>
      </div>
    </aside>
  );
}

/**
 * The actions. Open: the one filled button ("Enroll in the Weekend program",
 * "Enroll in Summer camp") and "Ask a question". Between seasons: "Hear first"
 * (secondary, to the footer's newsletter card) and "Ask a question"; no
 * filled button.
 */
function Actions({ program, stacked = false }: { program: Program; stacked?: boolean }) {
  const enrol = enrolOf(program);
  const ask = askOf(program);
  if (enrol) {
    return (
      <div className={cn("flex flex-col gap-3", !stacked && "sm:flex-row")}>
        <ButtonLink
          href={enrol.href}
          size="lg"
          fullWidth={stacked}
          // In the narrow card at 1024–1100 the long, specific label wraps to two lines: the
          // button grows instead of clipping (the fixed h-13 gives way, min-h keeps 52 px).
          className={cn(!stacked && "w-full sm:w-auto", stacked && "h-auto! min-h-13 py-3")}
        >
          {enrol.label}
        </ButtonLink>
        <ButtonLink
          href={ask.href}
          variant="secondary"
          size={stacked ? "md" : "lg"}
          fullWidth={stacked}
          className={cn(!stacked && "w-full sm:w-auto")}
        >
          {ask.label}
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-3", !stacked && "sm:flex-row")}>
      <ButtonLink
        href={hearFirst.href}
        variant="secondary"
        size="lg"
        fullWidth={stacked}
        className={cn(!stacked && "w-full sm:w-auto")}
      >
        {hearFirst.label}
      </ButtonLink>
      <TextLink label={ask.label} href={ask.href} className={cn(!stacked && "sm:px-2")} />
    </div>
  );
}

function Price({ program }: { program: Program }) {
  const price = priceOf(program);
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-heading-xl font-semibold text-ink tabular-nums">{price.amount}</span>
        {price.unit ? <span className="text-ui text-ink-muted">{price.unit}</span> : null}
      </p>
      <p className="mt-0.5 text-ui text-ink-muted">{price.note}</p>
    </div>
  );
}

/** "2027 dates coming soon": a quiet chip, never a status colour (it is not a status). */
export function ComingSoonChip({ text }: { text: string }) {
  return (
    <p className="inline-flex min-h-8 items-center gap-1.5 rounded-chip bg-surface-2 px-2.5 text-ui font-medium text-ink">
      <CalendarClock aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-accent-strong" />
      {text}
    </p>
  );
}
