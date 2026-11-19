import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchFrame } from "@/components/ui/ArchFrame";
import { ButtonLink } from "@/components/ui/Button";
import type { HomeHero as HomeHeroData, HomeHeroLayout, Instructor } from "@/content/types";
import { cn } from "@/lib/cn";
import { wholePhraseIndex } from "@/lib/text";
import { InstructorRow } from "./InstructorRow";

/**
 * Home hero (spec §7.1 section 1; PRODUCT.md owner decision 5).
 *
 *   teachers   (default, Concept B) centred headline, CTAs, trust strip, then
 *              the featured instructors in arch frames as the hero visual
 *   editorial  (Concept A) 7/5 split: large serif headline left, arch-framed
 *              photograph right, full-width trust strip beneath
 *   spacious   (Concept C) a broad arch window right, a quiet copy column left
 *
 * Content comes only from getHomeHero(), already validated, so lengths are
 * bounded and every layout holds at 375 and 1440. Every layout puts the copy
 * and CTAs first in the DOM, so on a phone the fold is text-first and the
 * image or instructors come after the CTAs.
 */

/** The header watches this id: its filled CTA yields while the hero's CTAs are on screen. */
export const HERO_CTAS_ID = "hero-ctas";
const TITLE_ID = "home-hero-title";

export function HomeHero({ hero, layout = hero.layout }: { hero: HomeHeroData; layout?: HomeHeroLayout }) {
  if (layout === "editorial") return <Editorial hero={hero} />;
  if (layout === "spacious") return <Spacious hero={hero} />;
  return <Teachers hero={hero} />;
}

/* ── Layouts ─────────────────────────────────────────────────────────────── */

function Teachers({ hero }: { hero: HomeHeroData }) {
  const people = hero.featuredInstructors;
  return (
    <section aria-labelledby={TITLE_ID} className="pt-6 pb-12 md:py-16 lg:py-20">
      <div className="container-content flex flex-col items-center text-center">
        <Eyebrow>{hero.eyebrow}</Eyebrow>
        <Headline hero={hero} className="mt-4 max-w-220 text-display-md md:mt-5 md:text-display-lg" />
        <Subhead className="mt-4 text-body-lg text-ink-body md:mt-6">{hero.subhead}</Subhead>
        <Ctas hero={hero} className="mt-6 w-full sm:w-auto md:mt-8" center />
        <Trust items={hero.trust} variant="centered" className="mt-6 md:mt-8" />
      </div>

      {people.length > 0 ? (
        <div className="container-content mt-8 md:mt-16">
          <h2 className="sr-only">Some of our instructors</h2>
          {/* One row, in order: a swipe row below 640 px, equal columns from 640. */}
          <InstructorRow count={people.length}>
            {people.map((person) => (
              <li key={person.id} className="row-span-3 grid snap-start grid-rows-subgrid">
                <InstructorCard person={person} />
              </li>
            ))}
          </InstructorRow>
          <p className="mt-2 text-center">
            <Link
              href="/instructors"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
            >
              Meet all our instructors
              <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Editorial({ hero }: { hero: HomeHeroData }) {
  return (
    <section aria-labelledby={TITLE_ID} className="container-content pt-8 pb-12 md:py-16 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-16">
        <div className="lg:col-span-7 lg:self-center">
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <Headline
            hero={hero}
            className="mt-4 text-display-md md:mt-5 md:text-display-lg xl:text-display-xl"
          />
          <Subhead className="mt-4 text-body-lg text-ink-body md:mt-6">{hero.subhead}</Subhead>
          <Ctas hero={hero} className="mt-6 md:mt-8" />
        </div>

        <Trust items={hero.trust} variant="strip" className="lg:order-last lg:col-span-12" />

        <div className="mx-auto w-full max-w-90 lg:col-span-5 lg:max-w-none lg:self-center lg:pl-6">
          <HeroImage
            hero={hero}
            ratio="portrait"
            sizes="(min-width: 64rem) 470px, (min-width: 30rem) 360px, calc(100vw - 2rem)"
          />
        </div>
      </div>
    </section>
  );
}

function Spacious({ hero }: { hero: HomeHeroData }) {
  return (
    <section aria-labelledby={TITLE_ID} className="container-content py-16 md:py-24 lg:py-32">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-x-6">
        <div className="lg:col-span-5">
          <Eyebrow className="text-balance">{hero.eyebrow}</Eyebrow>
          <Headline hero={hero} className="mt-6 text-heading-xl md:text-display-md" />
          <Subhead className="mt-6 text-body-lg text-ink-body">{hero.subhead}</Subhead>
          <Ctas hero={hero} className="mt-10" />
          <Trust items={hero.trust} variant="grid" className="mt-10" />
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <HeroImage
            hero={hero}
            ratio="window"
            sizes="(min-width: 75rem) 580px, (min-width: 64rem) 48vw, calc(100vw - 2rem)"
          />
        </div>
      </div>
    </section>
  );
}

/* ── Parts ───────────────────────────────────────────────────────────────── */

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  // Spec §7.1 mandates this eyebrow above the H1 (CLAUDE.md §5 exception).
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

/**
 * The H1. The highlight phrase sits on --mark (DESIGN.md §2, --ink on it
 * 13.2:1). Hyphenated compounds ("one-on-one") never break at a hyphen.
 */
function Headline({ hero, className }: { hero: HomeHeroData; className?: string }) {
  const { headline, highlight } = hero;
  // Validation guarantees a whole-word match exists; mark the first one that is.
  const at = highlight ? wholePhraseIndex(headline, highlight) : -1;
  const parts =
    highlight && at >= 0
      ? [headline.slice(0, at), highlight, headline.slice(at + highlight.length)]
      : [headline, "", ""];

  return (
    <h1 id={TITLE_ID} className={cn("font-medium text-balance", className)}>
      {keepCompounds(parts[0])}
      {parts[1] ? (
        <mark className="rounded-chip bg-mark px-1 text-ink [box-decoration-break:clone]">
          {keepCompounds(parts[1])}
        </mark>
      ) : null}
      {keepCompounds(parts[2])}
    </h1>
  );
}

function keepCompounds(text: string): ReactNode[] {
  return text
    .split(/(\S+-\S+)/)
    .map((part, i) =>
      /\S+-\S+/.test(part) ? (
        <span key={i} className="whitespace-nowrap">
          {part}
        </span>
      ) : (
        part
      ),
    );
}

function Subhead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-measure text-pretty", className)}>{children}</p>;
}

function Ctas({ hero, className, center = false }: { hero: HomeHeroData; className?: string; center?: boolean }) {
  return (
    <div
      id={HERO_CTAS_ID}
      className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", center && "sm:justify-center", className)}
    >
      <ButtonLink href={hero.primaryCta.href} size="lg" className="w-full sm:w-auto">
        {hero.primaryCta.label}
      </ButtonLink>
      <ButtonLink href={hero.secondaryCta.href} variant="secondary" size="lg" className="w-full sm:w-auto">
        {hero.secondaryCta.label}
      </ButtonLink>
    </div>
  );
}

/**
 * Trust facts (spec §7.1: one line with middle dots, directly beneath the
 * CTAs). Below the width where one line fits they become a 2 × 2 grid with
 * no separators, so a dot never starts a line.
 *   strip     one line between hairlines from lg (editorial)
 *   centered  one centred line from lg (teachers); the four items need ~890 px
 *   grid      2 × 2 under a hairline at every width (spacious column)
 */
function Trust({
  items,
  variant,
  className,
}: {
  items: string[];
  variant: "strip" | "centered" | "grid";
  className?: string;
}) {
  if (items.length === 0) return null;
  const inline = variant === "grid" ? null : "lg";

  return (
    <ul
      aria-label="About Ilm-Ul-Quran USA"
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-3 text-ui font-medium text-ink-body",
        variant === "strip" && "gap-x-6 border-y border-rule py-5 lg:flex lg:flex-wrap lg:items-center lg:gap-x-0 lg:text-body",
        variant === "centered" && "w-full gap-y-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-center lg:text-body",
        variant === "grid" && "gap-x-6 border-t border-rule pt-5",
        className,
      )}
    >
      {items.map((item, i) => (
        <li key={item} className={cn("flex items-center", variant === "centered" && "justify-center")}>
          {inline && i > 0 ? (
            <span
              aria-hidden="true"
              className={cn("hidden text-ink-muted lg:inline", variant === "strip" ? "px-6" : "px-5")}
            >
              ·
            </span>
          ) : null}
          {item}
        </li>
      ))}
    </ul>
  );
}

function HeroImage({ hero, ratio, sizes }: { hero: HomeHeroData; ratio: "portrait" | "window"; sizes: string }) {
  const { src, alt, width, height, focalPoint, blurDataURL } = hero.image;
  return (
    <ArchFrame
      name={alt}
      src={src}
      alt={alt}
      width={width}
      height={height}
      focalPoint={focalPoint}
      blurDataURL={blurDataURL}
      ratio={ratio}
      sizes={sizes}
      preload
    />
  );
}

/**
 * One link per instructor: portrait, name and role together, to the profile.
 * The link spans the card's three subgrid rows, so names and roles line up
 * across the row. Sizes (owner decision, 19 Nov 2026): name 14 / role 13 px
 * below 640, 13 / 12 px at 640–1023, 15 / 13 px from 1024. Text wraps to at
 * most two lines at these sizes and is never truncated; long words break
 * rather than overflow the card. The role (<= 24 characters) never repeats the
 * title already in the name. The link's accessible name is the visible
 * name and role; the portrait keeps its "Portrait of <name>" alt text.
 */
function InstructorCard({ person }: { person: Instructor }) {
  return (
    <Link
      href={`/instructors/${person.id}`}
      aria-label={`${person.name}, ${person.role}`}
      className="group row-span-3 grid grid-rows-subgrid rounded-card pb-2 text-center"
    >
      <InstructorArch person={person} />
      <span
        translate="no"
        className="mt-3 text-ui font-medium text-balance wrap-break-word text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline min-[40rem]:text-ui-sm lg:text-ui-md"
      >
        {person.name}
      </span>
      <span className="mt-0.5 text-ui-sm text-balance wrap-break-word text-ink-muted min-[40rem]:text-ui-xs lg:text-ui-sm">
        {person.role}
      </span>
    </Link>
  );
}

function InstructorArch({ person }: { person: Instructor }) {
  // The arch scales with its column, up to 200 px wide (owner decision).
  if (!person.photo) return <ArchFrame name={person.name} decorative className="mx-auto max-w-50" />;
  return (
    <ArchFrame
      name={person.name}
      alt={`Portrait of ${person.name}`}
      src={person.photo.src}
      width={person.photo.width}
      height={person.photo.height}
      sizes="(min-width: 64rem) 200px, (min-width: 40rem) 18vw, 40vw"
      className="mx-auto max-w-50"
      // All five are in the first view at 1440, so none is lazy. None is
      // preloaded or raised in priority: on a phone they sit below the
      // fold, and the H1 is the LCP element. 370 × 370, about 100 KB in all.
      loading="eager"
    />
  );
}
