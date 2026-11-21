import Link from "next/link";
import { ArchFrame } from "@/components/ui/ArchFrame";
import type { Instructor } from "@/content/types";
import { cn } from "@/lib/cn";

/**
 * InstructorCard (spec §6.3): one link per instructor, with portrait, name and
 * role together, to the profile. The card is a plain stack: portrait, name,
 * then the role 4 px under the name (owner decision, 19 Nov 2026). Text wraps
 * and is never truncated; long words break rather than overflow the card.
 * The role (≤ 24 characters) never repeats the title already in the name.
 * The link's accessible name is the visible name and role; the portrait keeps
 * its "Portrait of <name>" alt text. No photo → the arch monogram (spec §8).
 *
 *   hero   the Home hero row. Sizes: name 14 / role 13 px below 640,
 *          13 / 12 px at 640–1023, 15 / 13 px from 1024. Portraits load
 *          eagerly at low priority: all five are in the first view at 1440,
 *          and the H1 is the LCP element.
 *   grid   course pages: a compact arch (at most 128 px wide, photo and
 *          monogram alike, so mixed rows line up), name 15 px, role 13 px,
 *          then the teacher's own languages (owner, 20 Nov 2026: languages
 *          belong to each teacher, never to the class). Portraits are lazy.
 */
export function InstructorCard({
  person,
  variant = "hero",
  sizes,
  lazy = false,
}: {
  person: Instructor;
  variant?: "hero" | "grid";
  /** Load the portrait lazily: a hero-style card below the fold (Home §5). */
  lazy?: boolean;
  /** next/image sizes for the portrait. */
  sizes: string;
}) {
  const grid = variant === "grid";
  return (
    <Link
      href={`/instructors/${person.id}`}
      aria-label={
        grid
          ? `${person.name}, ${person.role}. Teaches in ${person.languages.join(", ")}`
          : `${person.name}, ${person.role}`
      }
      className="group flex flex-col rounded-card pb-2 text-center"
    >
      <InstructorArch person={person} sizes={sizes} eager={!grid && !lazy} width={grid ? "max-w-32" : "max-w-50"} />
      <span
        translate="no"
        className={cn(
          "mt-3 font-medium text-balance wrap-break-word text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline",
          grid ? "text-ui-md" : "text-ui min-[40rem]:text-ui-sm lg:text-ui-md",
        )}
      >
        {person.name}
      </span>
      <span
        className={cn(
          "mt-1 text-balance wrap-break-word text-ink-muted",
          grid ? "text-ui-sm" : "text-ui-sm min-[40rem]:text-ui-xs lg:text-ui-sm",
        )}
      >
        {person.role}
      </span>
      {grid ? (
        <span className="mt-1 text-ui-xs text-balance text-ink-muted" translate="no">
          {person.languages.join(" · ")}
        </span>
      ) : null}
    </Link>
  );
}

function InstructorArch({
  person,
  sizes,
  eager,
  width,
}: {
  person: Instructor;
  sizes: string;
  eager: boolean;
  /** Largest arch width: 200 px in the hero (owner decision), 128 px in course grids. */
  width: "max-w-50" | "max-w-32";
}) {
  if (!person.photo) return <ArchFrame name={person.name} decorative className={cn("mx-auto", width)} />;
  return (
    <ArchFrame
      name={person.name}
      alt={`Portrait of ${person.name}`}
      src={person.photo.src}
      width={person.photo.width}
      height={person.photo.height}
      sizes={sizes}
      // The portrait eases up 3% inside the arch on hover and focus (globals.css .arch-zoom).
      className={cn("arch-zoom mx-auto", width)}
      // The owner's files share one framing (eyes at 35%, centred), so every
      // portrait uses the same fit and position: cover, 50% 50% (20 Nov 2026).
      focalPoint={{ x: 50, y: 50 }}
      // Hero: none lazy, none preloaded or raised in priority. ArchFrame gives
      // eager images fetchPriority "low", which also stops React from
      // emitting a <link rel="preload"> for each portrait. next/image serves
      // each at the card's width (sizes), not at the source size.
      loading={eager ? "eager" : "lazy"}
    />
  );
}
