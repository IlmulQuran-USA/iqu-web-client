import { Price, PriceList, PriceRow, TextLink } from "@/components/course/PriceList";
import { FAQList } from "@/components/home/FAQAccordion";
import { InstructorRow } from "@/components/home/InstructorRow";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  catalogFaq,
  catalogGroups,
  catalogHeader,
  catalogTeachers,
  feeNote,
  typeFilter,
  whereToStart,
  type CatalogType,
} from "@/content/catalog";
import { instructors } from "@/content/instructors";
import { cn } from "@/lib/cn";
import { AnimatedList } from "@/components/motion/AnimatedList";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { SlidingFilter } from "@/components/motion/SlidingFilter";

/*
 * Course catalog sections (spec §7.2; plan approved by the owner, 21 Nov 2026).
 * Header · filter + the three groups · fees and scholarships · Where to start
 * (the page's one --tint section) · teachers · common questions. The final
 * band and the sticky bar are the page's only filled buttons.
 */

/* ── Header ──────────────────────────────────────────────────────────────── */

export function CatalogHeader() {
  return (
    <div id={catalogHeader.id} className="pt-2 pb-8 md:pb-12">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: catalogHeader.title }]} />
      <h1 id="catalog-title" className="mt-4 text-display-md font-medium md:text-display-lg">
        {catalogHeader.title}
      </h1>
      <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{catalogHeader.intro}</p>
      {/* The help for an unsure parent is further down; this gets them there from the top. */}
      <TextLink label={whereToStart.jumpLabel} href={`#${whereToStart.id}`} className="mt-2" />
      {/* From md the strip sits here; on phones it follows the list (FactsStrip below), so the
          first course is in the first screen (critique, 21 Nov 2026). */}
      <FactsStrip className="mt-5 hidden md:flex" />
    </div>
  );
}

/**
 * What every monthly course shares, once. One line with middle dots from md;
 * a two-column list below it, so a dot never starts a line. The caller sets
 * display (cn() does not resolve conflicts).
 */
export function FactsStrip({
  className,
  facts = catalogHeader.facts,
  label = "True of every monthly course",
}: {
  className?: string;
  facts?: readonly string[];
  label?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid-cols-2 items-start gap-x-4 gap-y-2 border-y border-rule py-4 text-ui font-medium text-ink-body md:flex-wrap md:items-center md:gap-x-0",
        className,
      )}
    >
      {facts.map((fact, i) => (
        <li key={fact} className="flex items-center">
          {i > 0 ? (
            <span aria-hidden="true" className="hidden px-3 text-ink-muted md:inline">
              ·
            </span>
          ) : null}
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Filter and results ──────────────────────────────────────────────────── */

/** The type filter: plain links, so every state has a URL and works without JavaScript (the page renders the filtered list on the server). */
function TypeFilter({ type, shown }: { type: CatalogType; shown: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Phones: the label above three equal options in one row. From sm: one line. */}
      <nav aria-label="Filter courses" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span aria-hidden="true" className="text-ui font-medium text-ink sm:mr-1">
          {typeFilter.label}
        </span>
        {/* The selected tint slides to the chosen option (Motion layoutId); plain links underneath. */}
        <SlidingFilter
          id="catalog-type"
          options={typeFilter.options}
          selected={type}
          className="grid grid-cols-3 gap-2 sm:flex"
        />
      </nav>
      <p role="status" className="text-ui text-ink-muted tabular-nums">
        {type === "all" ? catalogHeader.showing(shown) : catalogHeader.showingFiltered(shown)}
      </p>
    </div>
  );
}

/** The filter and the groups it shows. `type` comes from the URL (?type=monthly). */
export function CatalogResults({ type }: { type: CatalogType }) {
  const groups = catalogGroups.filter((g) => type === "all" || g.type === type);
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);
  return (
    <div>
      <TypeFilter type={type} shown={shown} />
      {/* A filter change fades groups out and in and glides the rest into place (Motion); on
          scroll each group rises in, its heading and rows following one another. */}
      <AnimatedList
        as="div"
        itemAs="div"
        items={groups.map((group) => ({ key: group.id, node: <Group group={group} /> }))}
      />
    </div>
  );
}

function Group({ group }: { group: (typeof catalogGroups)[number] }) {
  const headingId = `group-${group.id}`;
  return (
    <Reveal>
      <section aria-labelledby={headingId} className="mt-10 grid gap-6 md:mt-12 lg:grid-cols-12 lg:gap-6">
        {/* From lg the heading stays beside its rows while they scroll. */}
        <RevealItem className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:col-span-4 lg:self-start">
          <h2 id={headingId} className="text-heading-xl text-balance">
            {group.heading}
          </h2>
          {group.intro ? (
            <p className="mt-3 max-w-measure text-body text-pretty text-ink-body">{group.intro.text}</p>
          ) : null}
        </RevealItem>
        <PriceList labelledBy={headingId} className="lg:col-span-8">
          {group.rows.map((row, i) => (
            <PriceRow
              key={row.id}
              href={row.href}
              name={row.name}
              summary={row.summary}
              meta={row.meta}
              step={group.steps ? i + 1 : undefined}
              price={<Price {...row.price} />}
            />
          ))}
        </PriceList>
      </section>
    </Reveal>
  );
}

/* ── Fees and scholarships ───────────────────────────────────────────────── */

export function FeeNote() {
  return (
    <section
      id={feeNote.id}
      aria-labelledby="fees-title"
      className="mt-12 grid scroll-mt-4 gap-6 pb-12 md:mt-16 md:pb-16 lg:grid-cols-12 lg:gap-6 lg:pb-24"
    >
      <h2 id="fees-title" className="text-heading-xl text-balance lg:col-span-4">
        {feeNote.heading}
      </h2>
      <div className="border-t border-ink pt-5 lg:col-span-8">
        <ul className="flex max-w-measure list-disc flex-col gap-2 pl-5 text-body text-pretty text-ink-body marker:text-ink-muted">
          {feeNote.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-measure text-body text-pretty text-ink">
          {feeNote.scholarship} {feeNote.scholarshipRoute}
        </p>
        <TextLink {...feeNote.scholarshipLink} className="mt-1" />
      </div>
    </section>
  );
}

/* ── Where to start: the page's one --tint section (DESIGN.md §2) ────────── */

export function WhereToStart() {
  return (
    <section id={whereToStart.id} aria-labelledby="where-to-start-title" className="scroll-mt-4 bg-tint">
      <div className="container-content grid gap-8 py-12 md:py-16 lg:grid-cols-12 lg:gap-6 lg:py-24">
        <div className="lg:col-span-4">
          <h2 id="where-to-start-title" className="text-heading-xl text-balance md:text-display-md">
            {whereToStart.heading}
          </h2>
          <p className="mt-4 max-w-measure text-body text-pretty text-ink-body">{whereToStart.intro.text}</p>
        </div>
        <dl className="border-t border-ink lg:col-span-8">
          {whereToStart.rows.map((row) => (
            <div
              key={row.when}
              className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
            >
              <dt className="text-body text-pretty text-ink">{row.when}</dt>
              <dd className="flex flex-wrap gap-x-5 sm:justify-end">
                {row.links.map((link) => (
                  <TextLink key={link.href} label={link.label} href={link.href} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Teachers ────────────────────────────────────────────────────────────── */

export function CatalogTeachers() {
  const rows = catalogTeachers.rows.map((row) => ({
    heading: row.heading,
    people: row.ids.map((id) => {
      const person = instructors.find((p) => p.id === id);
      if (!person) throw new Error(`Catalog teacher ${id} is not in src/content/instructors.ts`);
      return person;
    }),
  }));
  return (
    <section id={catalogTeachers.id} aria-labelledby="catalog-teachers-title" className="container-content scroll-mt-4">
      <div className="py-12 md:py-16 lg:py-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div>
            <h2 id="catalog-teachers-title" className="text-heading-xl text-balance md:text-display-md">
              {catalogTeachers.heading}
            </h2>
            <p className="mt-4 max-w-measure text-body text-pretty text-ink-body">{catalogTeachers.rule}</p>
          </div>
          {/* From lg the link sits beside the heading; below lg it follows the row (as on Home §5). */}
          <div className="hidden shrink-0 lg:block">
            <TextLink {...catalogTeachers.all} />
          </div>
        </div>
        {rows.map((row, i) => (
          <div key={row.heading} className={i === 0 ? "mt-10 md:mt-12" : "mt-12 md:mt-16"}>
            <h3 className="border-b border-rule pb-3 font-sans text-ui font-medium text-ink">{row.heading}</h3>
            <div className="mt-6">
              <InstructorRow count={row.people.length}>
                {row.people.map((person) => (
                  <li key={person.id} className="snap-start">
                    <InstructorCard
                      person={person}
                      lazy
                      sizes="(min-width: 64rem) 200px, (min-width: 40rem) 18vw, 40vw"
                    />
                  </li>
                ))}
              </InstructorRow>
            </div>
          </div>
        ))}
        <div className="mt-8 lg:hidden">
          <TextLink {...catalogTeachers.all} />
        </div>
      </div>
    </section>
  );
}

/* ── Common questions ────────────────────────────────────────────────────── */

export function CatalogFAQ() {
  return (
    <section id={catalogFaq.id} aria-labelledby="catalog-faq-title" className="container-content scroll-mt-4">
      <div className="grid gap-8 border-t border-rule py-12 md:py-16 lg:grid-cols-12 lg:gap-6 lg:py-24">
        <h2 id="catalog-faq-title" className="text-heading-xl text-balance md:text-display-md lg:col-span-4">
          {catalogFaq.heading}
        </h2>
        <FAQList items={catalogFaq.items} className="lg:col-span-8" />
      </div>
    </section>
  );
}
