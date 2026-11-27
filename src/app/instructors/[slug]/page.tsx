import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { StickyCTA } from "@/components/home/StickyCTA";
import { AlsoTeaching, PROFILE_CTA_ID, ProfileBody, ProfileHeader } from "@/components/instructors/ProfileSections";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Header } from "@/components/layout/Header";
import { nextStepOf, offeringsOf, profileDescription, roleOf } from "@/content/instructors-page";
import { instructorById, instructors } from "@/content/instructors";
import type { Instructor } from "@/content/types";
import { pageMetadata } from "@/lib/metadata";
import { jsonLdHtml, personLd } from "@/lib/structured-data";

/*
 * Instructor profile (spec §7.5; plan approved by the owner, 22 Nov 2026).
 * One template for the 20 teachers in src/content/instructors.ts. The one
 * next step enrolls in a course they teach (the family is matched to a
 * teacher). Hafezah Humayra Afrin's profile stays noindex, as on the live site.
 */

// The 20 slugs are prerendered; any other slug renders the 404 (src/proxy.ts and notFound below).
export function generateStaticParams() {
  return instructors.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/instructors/[slug]">): Promise<Metadata> {
  const person = instructorById((await params).slug);
  if (!person) return {};
  return pageMetadata({
    title: person.name,
    description: profileDescription(person),
    path: `/instructors/${person.id}`,
    robots: person.noindex ? { index: false, follow: true } : undefined,
  });
}

/** Person structured data (spec §7.5 "Schema": Person + worksFor Organization). No ratings: there are none. */
function personJsonLd(person: Instructor) {
  return personLd({
    name: person.name,
    jobTitle: roleOf(person),
    path: `/instructors/${person.id}`,
    languages: person.languages,
    description: person.bio.status !== "pending" ? person.bio.text : undefined,
    image: person.photo?.src,
    knowsAbout: offeringsOf(person).map((o) => o.row.name),
  });
}

export default async function InstructorPage({ params }: PageProps<"/instructors/[slug]">) {
  const person = instructorById((await params).slug);
  if (!person) notFound();
  const next = nextStepOf(person);
  return (
    <MotionProvider>
      {person.noindex ? null : (
        <script
          type="application/ld+json"
          // Escape "<" so the JSON can never close the script element.
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(personJsonLd(person)) }}
        />
      )}
      {/* The profile's own button is in the first view, so the header CTA starts yielded. */}
      <Header
        yieldCtaTo={next.kind === "none" ? FINAL_CTA_ID : [PROFILE_CTA_ID, FINAL_CTA_ID]}
        yieldOnLoad={next.kind !== "none"}
      />
      <main id="main-content" aria-labelledby="profile-title">
        <div className="container-content">
          <ProfileHeader person={person} />
          <ProfileBody person={person} />
          <AlsoTeaching person={person} />
        </div>
        <FinalCta copy={next.final} />
      </main>
      <Footer />
      {next.kind === "none" ? null : (
        <StickyCTA
          label={next.label}
          href={next.href}
          afterId={PROFILE_CTA_ID}
          beforeId={FINAL_CTA_ID}
          title={person.name}
        />
      )}
    </MotionProvider>
  );
}
