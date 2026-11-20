import { ArrowLeft, ArrowRight, Check, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FAQList } from "@/components/home/FAQAccordion";
import { LocalTime } from "@/components/home/LocalTime";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import {
  curriculumHeading,
  faqFor,
  feeNotes,
  feeRows,
  highlightsOf,
  overviewBlocks,
  pathFor,
  scholarship,
  schedulePoints,
  shown,
  shownList,
  teachersIntro,
  teachersOf,
} from "@/content/course-page";
import { schedule as homeSchedule } from "@/content/home";
import type { Course } from "@/content/courses";
import { fromPrice, usd } from "@/content/pricing";
import type { Curriculum } from "@/content/types";
import { cn } from "@/lib/cn";
import { TextLink } from "./CourseHero";

/*
 * The course page sections (spec §7.3 sections 3–10; plan approved 20 Nov
 * 2026). All are in the DOM and reached from the sub-nav; a section with no
 * content is left out by sectionsOf() and never rendered empty. Each
 * curriculum takes the shape its source has: a class plan, steps, phases or
 * topics. Riwāq ledger language throughout: an --ink rule over a list of
 * hairline rows, serif names, tabular figures.
 */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    // Anchor offset: html scroll-padding covers the header and the sticky sub-nav (globals.css).
    <section id={id} aria-labelledby={`${id}-title`} className="border-t border-rule py-12 md:py-16">
      <h2 id={`${id}-title`} className="text-heading-xl text-balance md:text-display-md">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("font-display text-heading-md font-semibold text-ink", className)}>{children}</h3>;
}

/* ── 3 · Overview ────────────────────────────────────────────────────────── */

export function Overview({ course }: { course: Course }) {
  const blocks = overviewBlocks(course);
  const highlights = highlightsOf(course);
  const path = pathFor(course);
  return (
    <Section id="overview" title="Overview">
      {path ? <PathStrip steps={path.steps} /> : null}
      <div className={cn("mt-8 grid gap-10", highlights.length > 0 && "md:grid-cols-2 md:gap-8")}>
        <div className="flex flex-col gap-6">
          {blocks.map((block) => (
            <div key={block.label}>
              <SubHeading>{block.label}</SubHeading>
              <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">{block.text}</p>
            </div>
          ))}
        </div>
        {highlights.length > 0 ? (
          <div>
            <SubHeading>Course highlights</SubHeading>
            <ul className="mt-3 border-t border-ink">
              {highlights.map((item) => (
                <li key={item} className="flex gap-3 border-b border-rule py-3 text-body text-ink-body">
                  <Check aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-accent-strong" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** Noorani Qaidah → Qur’an Nazirah → Qur’an Hifz, with this course marked (COURSE-CONTENT.md §1). */
function PathStrip({ steps }: { steps: { id: string; label: string; href: string; current: boolean }[] }) {
  return (
    <div className="mt-6">
      <h3 className="font-sans text-ui font-medium text-ink-muted">The learning path</h3>
      <ol className="mt-3 grid grid-cols-3 border-y border-rule">
        {steps.map((step, i) => {
          const body = (
            <>
              <span className="block text-ui-sm text-ink-muted tabular-nums">Step {i + 1}</span>
              <span className="mt-0.5 block font-display text-body-lg font-semibold text-balance decoration-1 decoration-accent-strong underline-offset-4 group-hover/step:underline">
                {step.label}
              </span>
            </>
          );
          return (
            <li key={step.id} className={cn("flex", i > 0 && "border-l border-rule")}>
              {step.current ? (
                <span
                  aria-current="step"
                  className="-mt-px block w-full border-t-2 border-accent-strong px-3 py-3 text-ink sm:px-4"
                >
                  {body}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="group/step block w-full rounded-chip px-3 py-3 text-ink-body transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2 hov:text-ink sm:px-4"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── 4 · Curriculum and method ───────────────────────────────────────────── */

export function CurriculumSection({ course }: { course: Course }) {
  const { curriculum, method, path, assessment, outcomes, note } = course.content;
  const hasPlan = curriculum !== undefined && curriculum.kind !== "pending";
  const hasMethod = method !== undefined && method.kind !== "pending";
  const steps = shownList(path);
  const checks = shownList(assessment);
  const aims = shownList(outcomes);
  const footnote = shown(note);
  return (
    <Section id="curriculum" title={curriculumHeading(course)}>
      {hasPlan ? <CurriculumBody curriculum={curriculum} /> : null}
      {hasMethod ? (
        <div className={cn(hasPlan && "mt-12")}>
          {hasPlan ? <SubHeading>How it is taught</SubHeading> : null}
          {/* Under its own h3 when a curriculum precedes it; otherwise the h2 already names it. */}
          <CurriculumBody curriculum={method} nested={hasPlan} />
        </div>
      ) : null}
      {steps.length > 0 ? (
        <div className="mt-10">
          <SubHeading>Moving through the Qur’an</SubHeading>
          <ul className="mt-3 flex max-w-measure list-disc flex-col gap-1.5 pl-5 text-body text-ink-body marker:text-ink-muted">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {checks.length > 0 || aims.length > 0 ? (
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-8">
          {checks.length > 0 ? <ListBlock title="Assessment" items={checks} /> : null}
          {aims.length > 0 ? <ListBlock title="Outcomes, in sha’ Allah" items={aims} /> : null}
        </div>
      ) : null}
      {footnote ? <p className="mt-8 max-w-measure text-ui text-ink-muted">{footnote}</p> : null}
    </Section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <SubHeading>{title}</SubHeading>
      <ul className="mt-3 border-t border-ink">
        {items.map((item) => (
          <li key={item} className="border-b border-rule py-3 text-body text-ink-body">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CurriculumBody({ curriculum, nested = false }: { curriculum: Curriculum; nested?: boolean }) {
  const StepHeading = nested ? "h4" : "h3";
  switch (curriculum.kind) {
    case "classPlan":
      // The Noorani Qaidah 48-class plan: one row per block of classes.
      return (
        <ol aria-label="Class plan" className="mt-8 border-t border-ink">
          {curriculum.rows.map((row) => (
            <li key={row.classes} className="grid gap-2 border-b border-rule py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
              <p className="flex items-baseline gap-2 sm:flex-col sm:gap-0">
                <span className="text-ui text-ink-muted">Classes</span>
                <span className="font-display text-heading-lg font-semibold text-ink tabular-nums">{row.classes}</span>
              </p>
              <div>
                <p className="max-w-measure text-body text-pretty text-ink-body">{row.focus}</p>
                <p className="mt-2 flex items-center gap-1.5 text-ui text-ink-muted">
                  <ClipboardCheck aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-accent-strong" />
                  {row.checkpoint}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "steps":
      return (
        <ol className={cn("mt-6 grid gap-x-6 gap-y-8", curriculum.steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {curriculum.steps.map((step) => (
            <li key={step.title} className="border-t border-ink pt-4">
              <StepHeading className="font-display text-heading-md font-semibold text-ink">{step.title}</StepHeading>
              <p className="mt-2 text-body text-pretty text-ink-body">{step.text}</p>
            </li>
          ))}
        </ol>
      );
    case "phases":
      // Quranic Arabic Mastery: the year in phases, months on the left.
      return (
        <ol aria-label="The year in phases" className="mt-8 border-t border-ink">
          {curriculum.phases.map((phase) => (
            <li key={phase.title} className="grid gap-4 border-b border-rule py-6 md:grid-cols-[9rem_1fr] md:gap-6">
              <div>
                <p className="text-ui font-medium text-ink-muted tabular-nums">{phase.months}</p>
                <h3 className="mt-1 font-display text-heading-md font-semibold text-balance text-ink">{phase.title}</h3>
              </div>
              <div>
                <p className="max-w-measure text-body-lg text-pretty text-ink">{phase.goal}</p>
                <ul className="mt-4 grid list-disc gap-x-8 gap-y-1.5 pl-5 text-body text-ink-body marker:text-ink-muted sm:grid-cols-2">
                  {phase.topics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
                <p className="mt-4 max-w-measure text-ui text-ink-body">
                  <span className="font-medium text-ink">Practice: </span>
                  {phase.practice}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "topics":
      return (
        <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {curriculum.groups.map((group) => (
            <div key={group.title} className="border-t border-ink pt-4">
              <dt className="font-display text-heading-md font-semibold text-ink">{group.title}</dt>
              {group.items.map((item) => (
                <dd key={item} className="mt-1 text-body text-ink-body">
                  {item}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      );
    case "pending":
      return null;
  }
}

/* ── 5 · Teachers ────────────────────────────────────────────────────────── */

export function Teachers({ course }: { course: Course }) {
  const people = teachersOf(course);
  return (
    <Section id="teachers" title="Who teaches this course">
      <p className="mt-4 max-w-measure text-body text-pretty text-ink-body">{teachersIntro}</p>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {people.map((person) => (
          <li key={person.id}>
            <InstructorCard person={person} variant="grid" sizes="(min-width: 64rem) 180px, (min-width: 30rem) 30vw, 45vw" />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ── 6 · Schedule ────────────────────────────────────────────────────────── */

export function Schedule({ course }: { course: Course }) {
  const { teachingHours } = homeSchedule;
  return (
    <Section id="schedule" title="Schedule">
      <ul className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
        {schedulePoints(course).map((point) => (
          <li key={point.title} className="border-t border-ink pt-5">
            <h3 className="font-display text-heading-md font-semibold text-ink">{point.title}</h3>
            <p className="mt-2 text-body text-pretty text-ink-body">{point.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <LocalTime
          fromHour={teachingHours.from}
          toHour={teachingHours.to}
          hoursLabel={teachingHours.label}
          zones={teachingHours.zones}
        />
      </div>
    </Section>
  );
}

/* ── 7 · Fees and scholarships ───────────────────────────────────────────── */

export function Fees({ course }: { course: Course }) {
  const rows = feeRows(course);
  return (
    <Section id="fees" title="Fees and scholarships">
      <div className="mt-8 grid gap-8 md:grid-cols-5 md:gap-6">
        <div className="md:col-span-3">
          <table className="w-full border-t border-ink text-left">
            <caption className="sr-only">Monthly fee for {course.label}, by days a week</caption>
            <thead>
              <tr className="border-b border-rule text-ui text-ink-muted">
                <th scope="col" className="py-3 font-medium">
                  Days a week
                </th>
                <th scope="col" className="py-3 text-right font-medium">
                  Monthly fee
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.days} className="border-b border-rule">
                  <th scope="row" className="py-3 text-body font-normal text-ink-body">
                    {row.label}
                  </th>
                  <td className="py-3 text-right font-display text-heading-md font-semibold text-ink tabular-nums">
                    {row.fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-4 flex flex-col gap-1.5 text-ui text-ink-muted">
            {feeNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
        <div className="self-start rounded-card bg-surface-2 p-6 md:col-span-2">
          <h3 className="font-display text-heading-md font-semibold text-ink">{scholarship.heading}</h3>
          <p className="mt-2 text-body text-pretty text-ink-body">{scholarship.body}</p>
          <p className="mt-2 text-body text-pretty text-ink-body">{scholarship.route}</p>
          <TextLink {...scholarship.link} className="mt-2" />
        </div>
      </div>
    </Section>
  );
}

/* ── 10 · Course FAQ ─────────────────────────────────────────────────────── */

export function CourseFAQ({ course }: { course: Course }) {
  return (
    <Section id="faq" title="Common questions">
      <FAQList items={faqFor(course)} className="mt-8" />
    </Section>
  );
}

/* ── 9 · Where next (replaces spec "Related courses") ────────────────────── */

export function WhereNext({ course }: { course: Course }) {
  const path = pathFor(course);
  const links = [
    path?.previous ? { course: path.previous, label: "Comes before this course", back: true } : null,
    path?.next ? { course: path.next, label: "Next on the learning path", back: false } : null,
  ].filter((l) => l !== null);
  return (
    <nav aria-label="Where next" className="border-t border-rule py-12 md:py-16">
      {links.length > 0 ? (
        <ul className="mb-6 grid gap-4 sm:grid-cols-2">
          {links.map(({ course: c, label, back }) => (
            <li key={c.id} className={cn(!back && "sm:col-start-2")}>
              <Link
                href={c.href}
                className="group flex h-full items-center gap-4 rounded-card border border-rule p-5 transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
              >
                {back ? (
                  <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-ink-muted" />
                ) : null}
                <span className={cn("min-w-0 flex-1", !back && "text-right")}>
                  <span className="block text-ui text-ink-muted">{label}</span>
                  <span className="mt-1 block font-display text-heading-md font-semibold text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline">
                    {c.label}
                  </span>
                  <span className="mt-1 block text-ui text-ink-muted tabular-nums">From {usd(fromPrice(c))} a month</span>
                </span>
                {!back ? (
                  <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-ink-muted" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <TextLink label="See all courses" href="/courses" />
    </nav>
  );
}
