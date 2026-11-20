import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COURSE_CTAS_ID, COURSE_RAIL_ID, CourseHero, CourseRail } from "@/components/course/CourseHero";
import { CourseFAQ, CurriculumSection, Fees, Overview, Schedule, Teachers, WhereNext } from "@/components/course/CourseSections";
import { SectionNav } from "@/components/course/SectionNav";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { StickyCTA } from "@/components/home/StickyCTA";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { courseBySlug, ctas, fromLine, sectionsOf, shown } from "@/content/course-page";
import { courses, type Course } from "@/content/courses";
import { fromPrice } from "@/content/pricing";
import { site } from "@/content/site";

/*
 * Course detail (spec §7.3; plan approved by the owner, 20 Nov 2026). One
 * template for the six courses in src/content/pricing.ts. Every section is
 * in the DOM with an anchored sub-nav (CLAUDE.md §4); sections without
 * content are left out. No reviews, ratings, student counts, slot
 * availability or sibling discount. From lg the price and the one filled
 * button sit in a sticky card on the right; below lg the hero holds them and
 * the bottom bar takes over once they scroll away, as on Home.
 */

// The six slugs are prerendered; any other slug renders the 404 (notFound below).
export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.id }));
}

function description(course: Course): string {
  return shown(course.content.meta) ?? shown(course.content.overview) ?? `${course.label} at ${site.name}.`;
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = courseBySlug((await params).slug);
  if (!course) return {};
  return {
    title: course.label,
    description: description(course),
    // Islamic Studies stays out of search (and any sitemap) until its content is live (owner, 20 Nov 2026).
    ...(course.content.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Course + Offer structured data (spec §7.3 "Schema"). No AggregateRating: there are no reviews. */
function courseJsonLd(course: Course) {
  const url = `https://${site.domain}`;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.label,
    description: description(course),
    url: `${url}${course.href}`,
    provider: { "@type": "Organization", name: site.name, url },
    inLanguage: "en",
    offers: {
      "@type": "Offer",
      category: "Paid",
      price: fromPrice(course),
      priceCurrency: "USD",
    },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online" },
  };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const course = courseBySlug((await params).slug);
  if (!course) notFound();
  const sections = sectionsOf(course);
  const has = (id: string) => sections.some((s) => s.id === id);
  const enrol = ctas(course).enrol;

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd(course)).replace(/</g, "\\u003c") }}
      />
      <Header yieldCtaTo={[COURSE_RAIL_ID, FINAL_CTA_ID]} />
      <main id="main-content" aria-labelledby="course-title">
        <div className="container-content">
          {/* DOM order is hero, card, then the sections, so keyboard users reach the
              price and the enrol button straight after the hero (critique, owner
              20 Nov 2026). From lg the grid places the card beside both rows. */}
          <div className="grid lg:grid-cols-12 lg:gap-x-6">
            <div className="min-w-0 lg:col-span-8 lg:row-start-1">
              <CourseHero course={course} />
            </div>
            <CourseRail course={course} className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:pl-6" />
            <div className="min-w-0 lg:col-span-8 lg:row-start-2">
              <SectionNav sections={sections} />
              {has("overview") ? <Overview course={course} /> : null}
              {has("curriculum") ? <CurriculumSection course={course} /> : null}
              {has("teachers") ? <Teachers course={course} /> : null}
              <Schedule course={course} />
              <Fees course={course} />
              <CourseFAQ course={course} />
              <WhereNext course={course} />
            </div>
          </div>
        </div>
        <FinalCta href={enrol.href} />
      </main>
      <Footer />
      <StickyCTA
        label={enrol.label}
        href={enrol.href}
        afterId={COURSE_CTAS_ID}
        beforeId={FINAL_CTA_ID}
        title={course.label}
        detail={fromLine(course)}
      />
    </>
  );
}
