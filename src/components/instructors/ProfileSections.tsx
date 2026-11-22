import type { ReactNode } from "react";
import { Price, PriceList, PriceRow, TextLink } from "@/components/course/PriceList";
import { InstructorRow } from "@/components/home/InstructorRow";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { ArchFrame } from "@/components/ui/ArchFrame";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { nextStepOf, offeringsOf, othersLike, profileCopy as copy, roleOf } from "@/content/instructors-page";
import type { Instructor } from "@/content/types";

/*
 * Instructor profile sections (spec §7.5; plan approved by the owner,
 * 22 Nov 2026): header with the one next step · About · Qualifications ·
 * Certificates and Recitation (only when the data has them) · Courses taught
 * · Also teaching. Pending fields are not rendered. No ratings, reviews,
 * student counts, years of experience or "Popular courses".
 */

/** The mobile StickyCTA appears once this block scrolls away; the header CTA yields while it is in view. */
export const PROFILE_CTA_ID = "profile-cta";

export function ProfileHeader({ person }: { person: Instructor }) {
  const offerings = offeringsOf(person);
  const next = nextStepOf(person);
  return (
    <div className="pt-2 pb-10 md:pb-12">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Instructors", href: "/instructors" }, { label: person.name }]}
      />
      <div className="mt-6 grid gap-8 md:grid-cols-12 md:items-start md:gap-6">
        <div className="md:col-span-4">
          {person.photo ? (
            <ArchFrame
              name={person.name}
              alt={`Portrait of ${person.name}`}
              src={person.photo.src}
              width={person.photo.width}
              height={person.photo.height}
              sizes="(min-width: 48rem) 240px, 192px"
              focalPoint={{ x: 50, y: 50 }}
              loading="eager"
              className="mx-auto w-full max-w-48 md:mx-0 md:max-w-60"
            />
          ) : (
            // Female teachers and teachers without a portrait: the arch monogram (spec §7.4 note).
            <ArchFrame name={person.name} decorative className="mx-auto w-full max-w-48 md:mx-0 md:max-w-60" />
          )}
        </div>
        <div className="md:col-span-8">
          <h1 id="profile-title" translate="no" className="text-display-md font-medium text-balance md:text-display-lg">
            {person.name}
          </h1>
          <p className="mt-3 max-w-measure text-body-lg text-pretty text-ink-body">{roleOf(person)}</p>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-y border-rule py-4 text-ui">
            <dt className="text-ink-muted">{copy.languages}</dt>
            <dd translate="no" className="font-medium text-ink-body">
              {person.languages.join(" · ")}
            </dd>
            {offerings.length > 0 ? (
              <>
                <dt className="text-ink-muted">{copy.teaches}</dt>
                <dd className="font-medium text-ink-body">{offerings.map((o) => o.row.name).join(" · ")}</dd>
              </>
            ) : null}
          </dl>
          <div id={PROFILE_CTA_ID} className="mt-6">
            {next.kind === "none" ? (
              <TextLink label={next.label} href={next.href} />
            ) : (
              <ButtonLink href={next.href} size="lg" className="w-full sm:w-auto">
                {next.label}
              </ButtonLink>
            )}
            {/* The button enrolls in the course; the family is matched to a teacher (draft wording). */}
            <p className="mt-3 max-w-measure text-ui text-pretty text-ink-muted">{copy.matchingNote.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 border-t border-rule py-10 md:py-12">
      <h2 id={`${id}-title`} className="text-heading-xl text-balance">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ProfileBody({ person }: { person: Instructor }) {
  const offerings = offeringsOf(person);
  const audio = person.recitationAudio;
  const certificates = person.certificates;
  return (
    <div className="md:grid md:grid-cols-12 md:gap-6">
      <div className="md:col-span-8 md:col-start-5">
        {person.bio.status !== "pending" ? (
          <Section id="about" title={copy.about}>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">{person.bio.text}</p>
          </Section>
        ) : null}

        {person.qualifications.status !== "pending" ? (
          <Section id="qualifications" title={copy.qualifications}>
            <ul className="mt-4 max-w-measure">
              {person.qualifications.items.map((item) => (
                <li key={item} className="border-b border-rule py-3 text-body text-pretty text-ink-body">
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {certificates ? (
          <Section id="certificates" title={copy.certificates}>
            <ul className="mt-4 max-w-measure">
              {certificates.items.map((c) => (
                <li key={c.title} className="border-b border-rule py-3 text-body text-ink-body">
                  <span className="font-medium text-ink">{c.title}</span>
                  {c.issuer || c.year ? (
                    <span className="block text-ui text-ink-muted tabular-nums">
                      {[c.issuer, c.year].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {audio ? (
          <Section id="recitation" title={copy.recitation}>
            <figure className="mt-4 max-w-measure">
              <figcaption className="text-body text-ink-body">{audio.title}</figcaption>
              {/* Native controls: keyboard and screen-reader support come with the element. */}
              <audio controls preload="none" src={audio.src} className="mt-3 w-full">
                <a href={audio.src}>{audio.title}</a>
              </audio>
            </figure>
          </Section>
        ) : null}

        <Section id="courses" title={copy.courses}>
          {offerings.length > 0 ? (
            <>
              <p className="mt-4 max-w-measure text-body text-pretty text-ink-body">{copy.coursesIntro.text}</p>
              <PriceList labelledBy="courses-title" className="mt-6">
                {offerings.map(({ row }) => (
                  <PriceRow
                    key={row.id}
                    href={row.href}
                    name={row.name}
                    summary={row.summary}
                    meta={row.meta}
                    price={<Price {...row.price} />}
                  />
                ))}
              </PriceList>
            </>
          ) : (
            <div className="mt-4">
              <p className="max-w-measure text-body text-pretty text-ink-body">{copy.noCourses.text}</p>
              <TextLink label="See all courses" href="/courses" className="mt-1" />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

export function AlsoTeaching({ person }: { person: Instructor }) {
  const { people, labels } = othersLike(person);
  if (people.length === 0) return null;
  return (
    <section aria-labelledby="others-title" className="border-t border-rule py-12 md:py-16">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <h2 id="others-title" className="text-heading-xl text-balance">
          {copy.others(labels)}
        </h2>
        <TextLink label="See all teachers" href="/instructors" className="shrink-0" />
      </div>
      {/* The one reveal on a profile: the bio and qualifications never move (DESIGN.md §6). */}
      <Reveal className="mt-8">
        <InstructorRow count={people.length}>
          {people.map((p) => (
            <RevealItem as="li" key={p.id} className="snap-start">
              <InstructorCard person={p} lazy sizes="(min-width: 64rem) 200px, (min-width: 40rem) 18vw, 40vw" />
            </RevealItem>
          ))}
        </InstructorRow>
      </Reveal>
    </section>
  );
}
