import { FAQAccordion } from "@/components/home/FAQAccordion";
import { FamiliesSection } from "@/components/home/FamiliesSection";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { GivingBand } from "@/components/home/GivingBand";
import { HERO_CTAS_ID, HomeHero } from "@/components/home/HomeHero";
import { ProgramsLedger } from "@/components/home/ProgramsLedger";
import { ProgressSection } from "@/components/home/ProgressSection";
import { ScheduleSection } from "@/components/home/ScheduleSection";
import { StepList } from "@/components/home/StepList";
import { StickyCTA } from "@/components/home/StickyCTA";
import { TeachersSection } from "@/components/home/TeachersSection";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { finalCta } from "@/content/home";
import { socialLinks } from "@/content/navigation";
import { site } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import { getHomeHero } from "@/lib/content/home-hero";
import { pageMetadata } from "@/lib/metadata";

// Owner, 21 Nov 2026: the Home title and description, as supplied.
export const metadata = pageMetadata({
  title: { absolute: "Online Quran Classes for Kids & Adults · Ilm-Ul-Quran USA" },
  description:
    "Live Quran classes with qualified Huffaz, Ulama and Muftis for families in the US and Canada. Choose your own times. Your first month is free.",
  path: "/",
});

/*
 * Home (spec §7.1), as approved by the owner on 19–20 Nov 2026:
 *   1 Hero · 2 Scheduling · 3 Programs · 4 How it works · 5 Our teachers ·
 *   6 How progress is measured · 7 What families say · 8 Giving ·
 *   9 Common questions · 10 Final call to action.
 * Section 7 renders only verified testimonials, and not at all until one is
 * (src/content/testimonials.ts). No section uses --tint: the footer
 * newsletter band already takes the page's one tint section (DESIGN.md §2).
 */

/** Organization structured data (spec §7.1 SEO), built only from site facts. */
function organizationJsonLd() {
  const url = `https://${site.domain}`;
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "EducationalOrganization"],
    name: site.name,
    legalName: site.legalName,
    url,
    logo: `${url}/brand/logo-header.svg`,
    description: site.mission,
    nonprofitStatus: "Nonprofit501c3",
    taxID: site.ein,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.line1,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    ...(site.phone ? { telephone: site.phone.href.replace("tel:", "") } : {}),
    ...(site.email ? { email: site.email } : {}),
    sameAs: socialLinks.filter((l) => l.external).map((l) => l.href),
  };
}

export default async function HomePage() {
  const hero = await getHomeHero();

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()).replace(/</g, "\\u003c") }}
      />
      <Header yieldCtaTo={[HERO_CTAS_ID, FINAL_CTA_ID]} yieldOnLoad />
      <main id="main-content" className="flex flex-col">
        <HomeHero hero={hero} />
        {/* §2–§10 fade in and rise 30 px on a spring as they scroll into view, once; the hero
            never waits. Cards, rows, steps, testimonials, teachers and questions follow one
            another in (owner, 22 Nov 2026). */}
        <Reveal>
          <ScheduleSection />
        </Reveal>
        <Reveal>
          <ProgramsLedger />
        </Reveal>
        <Reveal>
          <StepList />
        </Reveal>
        <Reveal>
          <TeachersSection />
        </Reveal>
        <Reveal>
          <ProgressSection />
        </Reveal>
        <Reveal>
          <FamiliesSection />
        </Reveal>
        <Reveal>
          <GivingBand />
        </Reveal>
        <Reveal>
          <FAQAccordion />
        </Reveal>
        <Reveal>
          <FinalCta />
        </Reveal>
      </main>
      <Footer />
      <StickyCTA label={finalCta.button.label} href={finalCta.button.href} afterId={HERO_CTAS_ID} beforeId={FINAL_CTA_ID} />
    </>
  );
}
