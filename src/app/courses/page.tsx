import {
  CatalogFAQ,
  CatalogHeader,
  CatalogResults,
  CatalogTeachers,
  FactsStrip,
  FeeNote,
  WhereToStart,
} from "@/components/catalog/CatalogSections";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { StickyCTA } from "@/components/home/StickyCTA";
import { Footer } from "@/components/layout/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { Header } from "@/components/layout/Header";
import {
  catalogFinal,
  catalogGroups,
  catalogProgramsCta,
  catalogHeader,
  catalogMeta,
  catalogType,
} from "@/content/catalog";
import { courses } from "@/content/courses";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/metadata";

/*
 * Course catalog (spec §7.2; plan approved by the owner, 21 Nov 2026).
 * All eight offerings as a price list grouped by the learning path, with one
 * filter backed by real data (All · Monthly courses · Programs) whose state
 * lives in the URL (CLAUDE.md §7). No sort, no compare drawer, no invented
 * facets. The page renders the filtered list on the server, so a filter link
 * works without JavaScript and nothing swaps in after load.
 */

// Render each request with its ?type before sending (Next 16 instant-shell-url-data):
// a streamed shell would show the full list first and then swap it.
export const instant = false;

// Filtered views (?type=…) are the same page: one canonical, /courses.
export const metadata = pageMetadata({
  title: catalogMeta.title,
  description: catalogMeta.description,
  path: "/courses",
});

/** ItemList structured data. Islamic Studies stays out while its page is noindex. */
function itemListJsonLd() {
  const url = `https://${site.domain}`;
  const noindex = new Set(courses.filter((c) => c.content.noindex).map((c) => c.id));
  const rows = catalogGroups.flatMap((g) => g.rows).filter((r) => !noindex.has(r.id as never));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${catalogHeader.title} at ${site.name}`,
    itemListElement: rows.map((row, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: row.name,
      url: `${url}${row.href}`,
    })),
  };
}

export default async function CatalogPage({ searchParams }: PageProps<"/courses">) {
  const type = catalogType((await searchParams).type);
  // The free first month applies to monthly courses only: the programs view gets the programs CTA.
  const cta = type === "programs" ? catalogProgramsCta : catalogFinal;
  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd()).replace(/</g, "\\u003c") }}
      />
      {/* No hero CTA here: the header CTA is filled from the server and yields only to the final band. */}
      <Header yieldCtaTo={FINAL_CTA_ID} />
      <main id="main-content" aria-labelledby="catalog-title">
        <div className="container-content">
          <CatalogHeader />
          <CatalogResults type={type} />
          <FactsStrip className="mt-12 grid md:hidden" />
          <Reveal>
            <FeeNote />
          </Reveal>
        </div>
        {/* Below the list, each section rises in once on scroll (fade + 30 px, spring); questions follow one another. */}
        <Reveal>
          <WhereToStart />
        </Reveal>
        <Reveal>
          <CatalogTeachers />
        </Reveal>
        <Reveal>
          <CatalogFAQ />
        </Reveal>
        <FinalCta copy={cta} />
      </main>
      <Footer />
      <StickyCTA label={cta.button.label} href={cta.button.href} afterId={catalogHeader.id} beforeId={FINAL_CTA_ID} />
    </>
  );
}
