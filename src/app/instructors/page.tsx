import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { StickyCTA } from "@/components/home/StickyCTA";
import { DirectoryHeader, DirectoryResults, Matching, TeachWithUs } from "@/components/instructors/DirectorySections";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Header } from "@/components/layout/Header";
import { finalCtaFor } from "@/content/catalog";
import { directoryFilter, directoryHeader, directoryMeta, roleOf } from "@/content/instructors-page";
import { instructors } from "@/content/instructors";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/metadata";
import { itemListLd, jsonLdHtml } from "@/lib/structured-data";

/*
 * Instructor directory (spec §7.4; plan approved by the owner, 22 Nov 2026).
 * All 20 teachers in two groups, For brothers (leadership first) and For
 * sisters and boys up to 10, with two filters backed by real data: the
 * course they teach and the language. Filter state lives in the URL and the
 * page renders it on the server.
 */

// Filtered views (?course=…&lang=…) are the same page: one canonical, /instructors.
export const metadata = pageMetadata({
  title: directoryMeta.title,
  description: directoryMeta.description,
  path: "/instructors",
});

// Render each request with its filters before sending (no streamed full list first).
export const instant = false;

/** ItemList of Person profiles. Hafezah Humayra Afrin stays out while her profile is noindex. */
function itemListJsonLd() {
  return itemListLd(
    `Teachers at ${site.name}`,
    instructors
      .filter((p) => !p.noindex)
      .map((p) => ({ name: p.name, path: `/instructors/${p.id}`, item: { "@type": "Person", name: p.name, jobTitle: roleOf(p) } })),
  );
}

export default async function InstructorsPage({ searchParams }: PageProps<"/instructors">) {
  const filter = directoryFilter(await searchParams);
  const final = finalCtaFor("course");
  return (
    <MotionProvider>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script element.
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(itemListJsonLd()) }}
      />
      {/* No hero CTA here: the header CTA is filled from the server and yields only to the final band. */}
      <Header yieldCtaTo={FINAL_CTA_ID} />
      <main id="main-content" aria-labelledby="directory-title">
        <div className="container-content">
          <DirectoryHeader />
          <DirectoryResults filter={filter} />
        </div>
        <Matching />
        <TeachWithUs />
        <FinalCta copy={final} />
      </main>
      <Footer />
      <StickyCTA
        label={final.button.label}
        href={final.button.href}
        afterId={directoryHeader.id}
        beforeId={FINAL_CTA_ID}
      />
    </MotionProvider>
  );
}
