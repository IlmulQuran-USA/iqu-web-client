import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { TextLink } from "@/components/course/CourseHero";
import { CurriculumBody, Section, SubHeading } from "@/components/course/CourseSections";
import { FAQList } from "@/components/home/FAQAccordion";
import { Quote } from "@/components/home/FamiliesSection";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { teachersOf } from "@/content/course-page";
import type { Program } from "@/content/courses";
import {
  faqFor,
  familiesHeading,
  familiesOf,
  feeNotes,
  hearFirst,
  leadOf,
  otherProgramOf,
  overviewBlocks,
  overviewText,
  priceOf,
  resultsOf,
  scheduleOf,
  teachingOf,
} from "@/content/program-page";
import { WEEKDAY_NAMES, WEEKDAYS, daysInWords, wallTimeRange } from "@/content/program-timetable";
import { cn } from "@/lib/cn";
import { ClassTime } from "./ClassTime";
import { ComingSoonChip } from "./ProgramHero";

/*
 * The program page sections (spec §7.11; plan approved 23 Nov 2026). All are
 * in the DOM and reached from the sub-nav; a section with no content is left
 * out by sectionsOf() and never rendered empty. The Riwāq ledger language of
 * the course pages: an --ink rule over hairline rows, serif names, tabular
 * figures. The Fees section is the page's one --tint section.
 */

/* ── Overview ────────────────────────────────────────────────────────────── */

export function Overview({ program }: { program: Program }) {
  // The hero already opens with the first sentence; here the rest of the live overview.
  const full = overviewText(program) ?? "";
  const rest = full.slice(leadOf(program).length).trim();
  const teaching = teachingOf(program);
  return (
    <Section id="overview" title="Overview">
      {rest ? <p className="mt-6 max-w-measure text-body-lg text-pretty text-ink-body">{rest}</p> : null}
      <div className={cn("mt-8 grid gap-10", teaching.length > 0 && "md:grid-cols-2 md:gap-8")}>
        {teaching.length === 1 ? (
          // One line (Weekend) reads as a sentence, not a one-row ledger (critique, 23 Nov 2026).
          <div>
            <SubHeading>How it is taught</SubHeading>
            <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">{teaching[0]}.</p>
          </div>
        ) : teaching.length > 1 ? (
          <div>
            <SubHeading>How it is taught</SubHeading>
            <ul className="mt-3 border-t border-ink">
              {teaching.map((item) => (
                <li key={item} className="flex gap-3 border-b border-rule py-3 text-body text-ink-body">
                  <Check aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-accent-strong" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-6">
          {overviewBlocks.map((block) => (
            <div key={block.label}>
              <SubHeading>{block.label}</SubHeading>
              <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">{block.text}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Schedule: the week strip ────────────────────────────────────────────── */

/** One hour of class is this tall in the strip, so a two-hour day reads twice as long. */
const HOUR_REM = 1.5;

export function Schedule({ program }: { program: Program }) {
  const s = scheduleOf(program);
  const t = s.timetable;
  const [sh, sm] = t.start.split(":").map(Number);
  const [eh, em] = t.end.split(":").map(Number);
  const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
  const time = `${wallTimeRange(t.start, t.end)} ${t.zoneLabel}`;
  const facts: { label: string; value: string }[] = [
    { label: "Days", value: daysInWords(t.days) },
    { label: "Time", value: time },
    ...(s.dates ? [{ label: "Dates", value: s.dates }] : []),
    ...(s.weeks ? [{ label: "Length", value: `${s.weeks} weeks` }] : []),
    ...s.extras,
  ];
  return (
    <Section id="schedule" title={s.heading}>
      {s.comingSoon ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <ComingSoonChip text={s.comingSoon} />
          <TextLink label={hearFirst.label} href={hearFirst.href} />
        </div>
      ) : null}

      {/* The week, Monday first so a weekend reads as one block. A coral bar marks each class
          day, as tall as the session is long (decorative --accent shape, never text). */}
      <Reveal as="ol" aria-label={`Class days: ${daysInWords(t.days)}`} className="mt-8 grid grid-cols-7 border-y border-rule">
        {WEEKDAYS.map((day, i) => {
          const on = t.days.includes(day);
          return (
            <RevealItem
              as="li"
              key={day}
              className={cn(
                "flex flex-col items-center gap-3 px-1 pt-3 pb-4",
                i > 0 && "border-l border-rule",
                on ? "-mt-px border-t-2 border-t-accent-strong text-ink" : "text-ink-muted",
              )}
            >
              <span className={cn("text-ui tabular-nums", on && "font-semibold")}>
                <span aria-hidden="true">{day}</span>
                <span className="sr-only">
                  {WEEKDAY_NAMES[day]}: {on ? `class, ${time}` : "no class"}
                </span>
              </span>
              <span aria-hidden="true" className="flex w-full justify-center" style={{ height: `${2 * HOUR_REM}rem` }}>
                {on ? (
                  <span className="w-3/5 max-w-10 rounded-chip bg-accent" style={{ height: `${hours * HOUR_REM}rem` }} />
                ) : (
                  <span className="mt-2 h-px w-4 bg-rule" />
                )}
              </span>
            </RevealItem>
          );
        })}
      </Reveal>

      <div className="mt-8 grid gap-8 md:grid-cols-5 md:gap-8">
        <dl className="border-t border-ink md:col-span-3">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-6 border-b border-rule py-3">
              <dt className="text-ui text-ink-muted">{f.label}</dt>
              <dd className="text-right text-body font-medium text-ink tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
        {s.levels ? (
          <div className="md:col-span-2">
            <SubHeading>Two levels</SubHeading>
            <ul className="mt-3 border-t border-ink">
              {s.levels.map((l) => (
                <li key={l.name} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                  <span className="font-display text-heading-md font-semibold text-ink">{l.name}</span>
                  <span className="text-ui text-ink-body tabular-nums">{l.ages}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <ClassTime
          days={t.days}
          start={t.start}
          end={t.end}
          zone={t.zone}
          zoneName={`Central Time (${t.zoneLabel})`}
          onDate={s.onDate}
        />
      </div>
    </Section>
  );
}

/* ── Curriculum ──────────────────────────────────────────────────────────── */

export function Curriculum({ program }: { program: Program }) {
  const curriculum = program.content.curriculum;
  if (!curriculum || curriculum.kind === "pending") return null;
  return (
    <Section id="curriculum" title="What your child will learn">
      <CurriculumBody curriculum={curriculum} />
    </Section>
  );
}

/* ── Teachers: one ungrouped row (owner, 23 Nov 2026) ────────────────────── */

export function Teachers({ program }: { program: Program }) {
  const people = teachersOf(program);
  return (
    <Section id="teachers" title="Who teaches">
      <p className="mt-4 text-ui text-ink-muted tabular-nums">
        {people.length === 1 ? "1 teacher" : `${people.length} teachers`} on the {program.label}
      </p>
      <Reveal as="ul" className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {people.map((person) => (
          <RevealItem as="li" key={person.id}>
            <InstructorCard person={person} variant="grid" sizes="128px" />
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}

/* ── Fees: the page's one --tint section ─────────────────────────────────── */

export function Fees({ program }: { program: Program }) {
  const price = priceOf(program);
  return (
    <Section id="fees" title="What it costs">
      <div className="mt-8 rounded-card bg-tint p-6 md:p-8">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-display-lg font-medium text-ink tabular-nums">{price.amount}</span>
          {price.unit ? <span className="text-body-lg text-ink-body">{price.unit}</span> : null}
        </p>
        <ul className="mt-6 flex flex-col border-t border-ink">
          {feeNotes(program).map((note) => (
            <li key={note} className="flex gap-3 border-b border-rule py-3 text-body text-ink-body">
              <Check aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-accent-strong" />
              {note}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ── The 2026 camp (Summer only) ─────────────────────────────────────────── */

export function Results({ program }: { program: Program }) {
  const r = resultsOf(program);
  if (!r) return null;
  return (
    <Section id="results" title={`How the ${r.year} camp was assessed`}>
      <SubHeading className="mt-6">{r.title}</SubHeading>
      <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">Every student was assessed in five subjects.</p>
      {/* The five assessed subjects and their marks, as on the live results page (r.text). */}
      <Reveal as="ul" aria-label="Subjects assessed" className="mt-6 grid border-t border-ink sm:grid-cols-5">
        {r.subjects.map((subject) => (
          <RevealItem
            as="li"
            key={subject}
            // Phones: one row per subject, marks set right; from sm, five columns.
            className="flex items-baseline justify-between gap-3 border-b border-rule py-3 sm:flex-col sm:items-start sm:py-4 sm:pr-3"
          >
            <span className="font-display text-body-lg font-semibold text-balance text-ink">{subject}</span>
            <span className="text-ui text-ink-muted tabular-nums">out of {r.marksEach}</span>
          </RevealItem>
        ))}
      </Reveal>
      {/* No link out: the full results page (/results/summer-2026) is not built yet, and the old site is never linked (owner, 27 Nov 2026). */}
    </Section>
  );
}

/* ── What families say ───────────────────────────────────────────────────── */

/**
 * That program's own testimonials (all "sample" for now: shown for admin
 * review, owner 21 Nov 2026). No ratings or counts. The first is set larger
 * across the column; the other two sit side by side below it.
 */
export function Families({ program }: { program: Program }) {
  const items = familiesOf(program);
  if (items.length === 0) return null;
  const [first, ...others] = items;
  return (
    <Section id="families" title={familiesHeading}>
      <Reveal as="ul" className="mt-8 grid gap-10 md:grid-cols-2 md:gap-x-8">
        <RevealItem as="li" className="md:col-span-2 [&_blockquote]:font-display [&_blockquote]:text-heading-lg">
          <Quote t={first} showProgram={false} />
        </RevealItem>
        {others.map((t) => (
          <RevealItem as="li" key={t.id}>
            <Quote t={t} showProgram={false} />
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */

export function ProgramFAQ({ program, newsletterOpen }: { program: Program; newsletterOpen: boolean }) {
  return (
    <Section id="faq" title="Common questions">
      <FAQList items={faqFor(program, newsletterOpen)} className="mt-8" />
    </Section>
  );
}

/* ── Where next ──────────────────────────────────────────────────────────── */

export function WhereNext({ program }: { program: Program }) {
  const other = otherProgramOf(program);
  return (
    <nav aria-label="Where next" className="border-t border-rule py-12 md:py-16">
      <Reveal as="ul" className="mb-6 grid gap-4 sm:grid-cols-2">
        <RevealItem as="li">
          <Link
            href={other.href}
            className="lift-card group relative flex h-full items-center gap-4 rounded-card border border-rule bg-paper p-5 hov:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-ui text-ink-muted">The other program</span>
              <span className="mt-1 block font-display text-heading-md font-semibold text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline">
                {other.label}
              </span>
              <span className="mt-1 block text-ui text-ink-muted tabular-nums">
                {other.meta} · {other.price}
              </span>
            </span>
            <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-ink-muted" />
          </Link>
        </RevealItem>
      </Reveal>
      <TextLink label="See all courses" href="/courses" />
    </nav>
  );
}
