import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionNav } from "@/components/course/SectionNav";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { StickyCTA } from "@/components/home/StickyCTA";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/motion/Reveal";
import { PROGRAM_CTAS_ID, PROGRAM_RAIL_ID, ProgramHero, ProgramRail } from "@/components/program/ProgramHero";
import {
  Curriculum,
  Families,
  Fees,
  Overview,
  ProgramFAQ,
  Results,
  Schedule,
  Teachers,
  WhereNext,
} from "@/components/program/ProgramSections";
import { programList, type Program } from "@/content/courses";
import { descriptionOf, finalCtaOf, programBySlug, seasonForSchema, sectionsOf, stickyOf } from "@/content/program-page";
import { pageMetadata } from "@/lib/metadata";
import { courseLd, jsonLdHtml } from "@/lib/structured-data";
import { newsletterConfig } from "@/lib/server/brevo";

/*
 * Program pages (spec §7.11; COURSE-CONTENT.md §9; CONTENT-ADDENDUM.md §5;
 * plan approved by the owner, 23 Nov 2026). One template for the Weekend Ilm
 * Program and Summer Ilm Camp, driven by src/content/program-page.ts. Every
 * section is in the DOM with an anchored sub-nav (CLAUDE.md §4). The layout
 * is the course page's: from lg the price and the one filled button sit in a
 * sticky card on the right; below lg the hero holds them and the bottom bar
 * takes over once they scroll away.
 *
 * Summer between seasons (no next-run dates in src/content/program-timetable.ts)
 * has no enrol button: the card says the dates are coming soon and points
 * to the newsletter, and the final band and phone bar offer the Weekend
 * program, which runs all year (owner, 23 Nov 2026).
 */

export function generateStaticParams() {
  return programList.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const program = programBySlug((await params).slug);
  if (!program) return {};
  return pageMetadata({ title: program.label, description: descriptionOf(program), path: program.href });
}

/** Course + Offer structured data. No AggregateRating: there are no reviews. Dates only for an open run. */
function programJsonLd(program: Program) {
  const season = seasonForSchema(program);
  return courseLd({
    name: program.label,
    description: descriptionOf(program),
    path: program.href,
    price: program.fee,
    free: program.fee === 0,
    instance: season ? { startDate: season.start, endDate: season.end } : undefined,
  });
}

export default async function ProgramPage({ params }: PageProps<"/programs/[slug]">) {
  const program = programBySlug((await params).slug);
  if (!program) notFound();
  const sections = sectionsOf(program);
  const has = (id: string) => sections.some((s) => s.id === id);
  const final = finalCtaOf(program);
  const sticky = stickyOf(program);
  // Read on the server only, as the footer does: whether the newsletter sign-up form works.
  const newsletterOpen = newsletterConfig() !== null;

  return (
    <MotionProvider>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script element.
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(programJsonLd(program)) }}
      />
      <Header yieldCtaTo={[PROGRAM_RAIL_ID, FINAL_CTA_ID]} yieldOnLoad />
      <main id="main-content" aria-labelledby="program-title">
        <div className="container-content">
          {/* DOM order: hero, card, then the sections, so keyboard users reach the price and
              the actions straight after the hero. From lg the card spans both rows. */}
          <div className="grid lg:grid-cols-12 lg:gap-x-6">
            <div className="min-w-0 lg:col-span-8 lg:row-start-1">
              <ProgramHero program={program} />
            </div>
            <ProgramRail program={program} className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:pl-6" />
            <div className="min-w-0 lg:col-span-8 lg:row-start-2">
              <SectionNav sections={sections} />
              {has("overview") ? <Overview program={program} /> : null}
              <Schedule program={program} />
              {has("curriculum") ? <Curriculum program={program} /> : null}
              {has("teachers") ? <Teachers program={program} /> : null}
              <Fees program={program} />
              {has("results") ? <Results program={program} /> : null}
              {has("families") ? <Families program={program} /> : null}
              <ProgramFAQ program={program} newsletterOpen={newsletterOpen} />
              <WhereNext program={program} />
            </div>
          </div>
        </div>
        <Reveal>
          <FinalCta copy={final} />
        </Reveal>
      </main>
      <Footer />
      <StickyCTA
        label={sticky.label}
        href={sticky.href}
        afterId={PROGRAM_CTAS_ID}
        beforeId={FINAL_CTA_ID}
        title={sticky.title}
        titleWraps
      />
    </MotionProvider>
  );
}
