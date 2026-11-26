import { FaqGroupList } from "@/components/faq/FaqGroupList";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { TextLink } from "@/components/ui/TextLink";
import { faqContact, faqEntries, faqGroups, faqHeader, faqMeta } from "@/content/faq";
import { finalCta } from "@/content/home";
import { pageMetadata } from "@/lib/metadata";

/*
 * FAQ — /faq (spec §7.14; owner, 26 Nov 2026). The owner's seven groups, a
 * topic list to jump between them, each answer with its related link, then
 * "Still have questions?" → /contact and the enrollment band (the page's one
 * filled button; the header CTA yields to it). Content and the source of
 * every answer: src/content/faq.ts. Server-rendered, no client code of its
 * own and no Motion: the disclosure is native <details>.
 *
 * Not built from spec §7.14: the search field (owner decision pending; it
 * needs client JavaScript), and the Technology/Safeguarding groups (the
 * owner's group list replaces the spec's).
 */

export const metadata = pageMetadata({ title: faqMeta.title, description: faqMeta.description, path: "/faq" });

/** FAQPage structured data: every question with its answer as plain text. */
function faqJsonLd() {
  const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: [item.a, ...(item.points ?? []), item.after ?? ""].filter(Boolean).map(plain).join(" "),
      },
    })),
  };
}

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can never close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c") }}
      />
      <Header yieldCtaTo={FINAL_CTA_ID} />
      <main id="main-content" className="flex-1">
        <div className="container-content">
          <div className="pt-2 pb-8 md:pb-12">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "FAQ" }]} />
            <h1 className="mt-4 text-display-md font-medium text-balance md:text-display-lg">{faqHeader.title}</h1>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{faqHeader.lead}</p>
            <nav aria-labelledby="faq-topics" className="mt-8">
              <h2 id="faq-topics" className="eyebrow">
                Topics
              </h2>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-0">
                {faqGroups.map((g) => (
                  <li key={g.id}>
                    <a
                      href={`#${g.id}`}
                      className="inline-flex min-h-11 items-center rounded-chip text-body text-link underline decoration-1 underline-offset-2 hov:decoration-2"
                    >
                      {g.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {faqGroups.map((group) => (
            <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="border-t border-rule py-12 md:py-16">
              <div className="grid gap-6 lg:grid-cols-12 lg:gap-x-6">
                <h2 id={`${group.id}-title`} className="text-heading-xl md:text-display-md lg:col-span-4">
                  {group.title}
                </h2>
                <FaqGroupList items={group.items} className="lg:col-span-8" />
              </div>
            </section>
          ))}

          {/* "Still have questions?" → /contact (owner, 26 Nov 2026): a text link, never a second filled button. */}
          <section aria-labelledby="faq-contact-title" className="border-t border-rule py-10">
            <h2 id="faq-contact-title" className="font-display text-heading-lg font-semibold text-ink">
              {faqContact.heading}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 text-body text-ink-body">
              <span>{faqContact.text}</span>
              <TextLink label={faqContact.link.label} href={faqContact.link.href} />
            </p>
          </section>
        </div>

        <FinalCta copy={finalCta} />
      </main>
      <Footer />
    </>
  );
}
