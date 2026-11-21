import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { teachersSection as copy } from "@/content/home";
import { instructors } from "@/content/instructors";
import { cn } from "@/lib/cn";
import { InstructorRow } from "./InstructorRow";

/**
 * Home §5 · Our teachers (spec §7.1 section 5; owner, 20 Nov 2026).
 * A facts line counted from src/content/instructors.ts, then two rows in the
 * hero's card and row (one row always: a swipe row on phones, five equal
 * columns from 640 px), grouped by who the student learns with. No
 * credential lines here (owner, 21 Nov 2026): qualifications belong to the
 * profile pages. Teachers without a portrait keep the arch monogram, with
 * initials from the name, never a title. The five hero instructors are not
 * repeated here.
 */
export function TeachersSection() {
  return (
    <section id={copy.id} aria-labelledby="teachers-title" className="container-content scroll-mt-4">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div>
            <h2 id="teachers-title" className="text-heading-xl text-balance md:text-display-md">
              {copy.heading}
            </h2>
            {/* One line with middle dots from lg; a two-column list below it, so a dot never starts a line. */}
            <ul
              aria-label="Our teachers in numbers"
              className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-ui font-medium text-ink-body tabular-nums lg:flex lg:flex-wrap lg:gap-x-0"
            >
              {copy.facts.map((fact, i) => (
                <li key={fact} className={cn("flex items-center", i === copy.facts.length - 1 && "col-span-2")}>
                  {i > 0 ? (
                    <span aria-hidden="true" className="hidden px-3 text-ink-muted lg:inline">
                      ·
                    </span>
                  ) : null}
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* From lg the link sits beside the heading; below lg it follows the rows (critique, 20 Nov 2026). */}
          <AllLink className="hidden lg:inline-flex" />
        </div>

        {copy.rows.map((row, i) => {
          const people = row.ids.map((id) => instructors.find((p) => p.id === id)!);
          return (
            <div key={row.heading} className={i === 0 ? "mt-10 md:mt-12" : "mt-12 md:mt-16"}>
              <h3 className="border-b border-rule pb-3 font-sans text-ui font-medium text-ink">{row.heading}</h3>
              <div className="mt-6">
                <InstructorRow count={people.length}>
                  {people.map((person, i) => (
                    <li
                      key={person.id}
                      className="snap-start"
                      data-reveal-item=""
                      style={{ "--reveal-i": i } as CSSProperties}
                    >
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
          );
        })}

        <AllLink className="mt-8 inline-flex lg:hidden" />
      </div>
    </section>
  );
}

function AllLink({ className }: { className?: string }) {
  return (
    <Link
      href={copy.all.href}
      className={cn(
        "min-h-11 shrink-0 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2",
        className,
      )}
    >
      {/* Display is set by the caller (cn() joins classes; it does not resolve conflicts). */}
      {copy.all.label}
      <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
    </Link>
  );
}
