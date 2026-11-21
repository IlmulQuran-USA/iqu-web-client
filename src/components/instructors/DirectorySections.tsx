import Link from "next/link";
import { FactsStrip } from "@/components/catalog/CatalogSections";
import { TextLink } from "@/components/course/PriceList";
import { FAQList } from "@/components/home/FAQAccordion";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  courseOptions,
  directoryCopy as copy,
  directoryGroups,
  directoryHeader,
  filterHref,
  languageOptions,
  leadershipIds,
  matches,
  matching,
  teachWithUs,
  type DirectoryFilter,
} from "@/content/instructors-page";
import { instructors } from "@/content/instructors";
import type { Instructor } from "@/content/types";
import { cn } from "@/lib/cn";
import { CourseSelect } from "./CourseSelect";

/*
 * Instructor directory sections (spec §7.4; plan approved by the owner,
 * 22 Nov 2026): header · filters · For brothers (leadership first) · For
 * sisters and boys up to 10 · how we match · teach with us. The final band
 * is the page's one filled button.
 */

export function DirectoryHeader() {
  return (
    <div id={directoryHeader.id} className="pt-2 pb-8 md:pb-10">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Instructors" }]} />
      <h1 id="directory-title" className="mt-4 text-display-md font-medium md:text-display-lg">
        {directoryHeader.title}
      </h1>
      <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{directoryHeader.intro}</p>
      <FactsStrip facts={directoryHeader.facts} label="Our teachers in numbers" className="mt-6 grid md:flex" />
    </div>
  );
}

/* ── Filters ─────────────────────────────────────────────────────────────── */

function Filters({ filter, shown }: { filter: DirectoryFilter; shown: number }) {
  const lang = filter.lang?.toLowerCase() ?? null;
  const filtered = filter.course !== null || filter.lang !== null;
  return (
    <div className="flex flex-col gap-5 border-b border-rule pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
        {/* A GET form, so the filter works without JavaScript (the Show button appears only then). */}
        <form method="get" action="/instructors" role="search" aria-label="Filter teachers by course">
          <label htmlFor="filter-course" className="text-ui font-medium text-ink">
            {copy.filterLabels.course}
          </label>
          {/* Keyed by the value, so a link that changes the filter resets the select too. */}
          <CourseSelect
            key={filter.course ?? "all"}
            id="filter-course"
            name="course"
            value={filter.course}
            lang={lang}
            anyLabel={copy.filterLabels.allCourses}
            options={courseOptions}
          />
          {lang ? <input type="hidden" name="lang" value={lang} /> : null}
          <noscript>
            <button
              type="submit"
              className="mt-2 inline-flex min-h-11 items-center rounded-button border border-ink-body px-4 text-ui text-ink-body"
            >
              {copy.filterLabels.apply}
            </button>
          </noscript>
        </form>

        <nav aria-label="Filter teachers by language">
          <span aria-hidden="true" className="text-ui font-medium text-ink">
            {copy.filterLabels.language}
          </span>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[null, ...languageOptions].map((option) => {
              const selected = option === filter.lang;
              return (
                <li key={option ?? "any"}>
                  <Link
                    href={filterHref({ course: filter.course, lang: option })}
                    scroll={false}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-button border px-3 text-ui transition-colors duration-(--duration-micro) ease-riwaq sm:px-4",
                      selected
                        ? "border-accent-strong bg-tint font-medium text-ink"
                        : "border-rule text-ink-body hov:bg-surface-2 hov:text-ink",
                    )}
                  >
                    {option ?? copy.filterLabels.any}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-x-4">
        <p role="status" className="text-ui text-ink-muted tabular-nums">
          {copy.showing(shown)}
        </p>
        {filtered ? (
          <Link
            href="/instructors"
            scroll={false}
            className="inline-flex min-h-11 items-center rounded-chip text-ui font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
          >
            {copy.clear}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ── Groups ──────────────────────────────────────────────────────────────── */

function Grid({ people }: { people: Instructor[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {people.map((person) => (
        <li key={person.id}>
          <InstructorCard person={person} variant="grid" sizes="128px" />
        </li>
      ))}
    </ul>
  );
}

/** What the filter is about, in words, for the empty states. */
function filterWords(filter: DirectoryFilter): string {
  const course = courseOptions.find((o) => o.id === filter.course)?.label;
  if (course && filter.lang) return `${course} in ${filter.lang}`;
  if (course) return course;
  return `classes in ${filter.lang}`;
}

export function DirectoryResults({ filter }: { filter: DirectoryFilter }) {
  const filtered = filter.course !== null || filter.lang !== null;
  const people = instructors.filter((p) => matches(p, filter));
  return (
    <div className="pb-12 md:pb-16 lg:pb-24">
      <Filters filter={filter} shown={people.length} />

      {people.length === 0 ? (
        <div className="mt-10">
          <p className="max-w-measure text-body-lg text-pretty text-ink">{copy.emptyAll(filterWords(filter))}</p>
          <div className="mt-2 flex flex-wrap gap-x-6">
            <TextLink label={copy.clear} href="/instructors" />
            <TextLink {...copy.ask} />
          </div>
        </div>
      ) : (
        directoryGroups.map((group) => {
          const inGroup = people.filter((p) => p.gender === group.gender);
          // Leadership first and larger, only on the unfiltered list (spec §7.4 section 4).
          const leaders =
            !filtered && group.gender === "male"
              ? leadershipIds.map((id) => inGroup.find((p) => p.id === id)!).filter(Boolean)
              : [];
          const rest = inGroup.filter((p) => !leaders.includes(p));
          const headingId = `group-${group.gender}`;
          return (
            <section key={group.gender} aria-labelledby={headingId} className="mt-12 md:mt-16">
              <h2
                id={headingId}
                className="border-b border-ink pb-3 font-display text-heading-lg font-semibold text-balance text-ink"
              >
                {group.heading}
                {inGroup.length > 0 ? (
                  // A middle dot keeps the count apart from a heading that ends in a number ("up to 10").
                  <span className="font-sans text-ui font-normal whitespace-nowrap text-ink-muted tabular-nums">
                    <span aria-hidden="true" className="mx-2">
                      ·
                    </span>
                    {inGroup.length === 1 ? "1 teacher" : `${inGroup.length} teachers`}
                  </span>
                ) : null}
              </h2>

              {inGroup.length === 0 ? (
                <div className="mt-4">
                  <p className="max-w-measure text-body text-pretty text-ink-body">
                    {group.empty(filterWords(filter))}
                  </p>
                  <TextLink {...copy.ask} className="mt-1" />
                </div>
              ) : null}

              {leaders.length > 0 ? (
                <div className="mt-8">
                  <h3 className="text-ui font-medium text-ink">{copy.leadership}</h3>
                  <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 lg:w-3/4">
                    {leaders.map((person) => (
                      <li key={person.id}>
                        <InstructorCard
                          person={person}
                          sizes="(min-width: 64rem) 200px, (min-width: 40rem) 25vw, 30vw"
                          lazy
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rest.length > 0 ? (
                <div className={leaders.length > 0 ? "mt-12 border-t border-rule pt-8" : "mt-8"}>
                  <Grid people={rest} />
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

/* ── How we match, and teach with us ─────────────────────────────────────── */

export function Matching() {
  return (
    <section id={matching.id} aria-labelledby="matching-title" className="container-content scroll-mt-4">
      <div className="grid gap-8 border-t border-rule py-12 md:py-16 lg:grid-cols-12 lg:gap-6 lg:py-24">
        <div className="lg:col-span-4">
          <h2 id="matching-title" className="text-heading-xl text-balance md:text-display-md">
            {matching.heading}
          </h2>
          <p className="mt-4 max-w-measure text-body text-pretty text-ink-body">{matching.text.text}</p>
        </div>
        <FAQList items={matching.items} className="lg:col-span-8" />
      </div>
    </section>
  );
}

export function TeachWithUs() {
  return (
    <div className="container-content">
      <div className="flex flex-col gap-1 border-t border-rule py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-body text-pretty text-ink-body">{teachWithUs.text.text}</p>
        <TextLink {...teachWithUs.link} className="shrink-0" />
      </div>
    </div>
  );
}
