import { site } from "../content/site.ts";
import { siteUrl } from "./site-env.ts";

/*
 * JSON-LD for every page type, built only from site facts (PRODUCT.md "Name
 * and entity"; src/content/site.ts). Pure, so src/lib/structured-data.test.ts
 * validates the shapes. URLs use the site's origin (NEXT_PUBLIC_SITE_URL;
 * https://ilmulquranus.org on the public site), so staging never points
 * search engines at itself as the real site.
 *
 * One organisation node, with an @id, that every Course, Person and FAQ page
 * points to instead of repeating it.
 */

export type JsonLd = Record<string, unknown> & { "@context": "https://schema.org"; "@type": string | string[] };

export const origin = () => siteUrl().origin;
export const abs = (path: string) => new URL(path, siteUrl()).toString();
export const ORG_ID = () => `${origin()}/#organization`;

/** A reference to the organisation node (on the Home page). */
export const orgRef = () => ({ "@type": ["EducationalOrganization", "NGO"], "@id": ORG_ID(), name: site.name, url: `${origin()}/` });

/** EducationalOrganization + NGO (spec §7.1 SEO). Facts only: name, legal entity, 501(c)(3), EIN, address, contact, area served. */
export function organizationLd(sameAs: string[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": ["EducationalOrganization", "NGO"],
    "@id": ORG_ID(),
    name: site.name,
    legalName: site.legalName,
    url: `${origin()}/`,
    logo: `${origin()}/brand/logo-header.svg`,
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
    // Classes are offered in the United States and Canada only (PRODUCT.md; the live Privacy Policy).
    areaServed: [
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "Canada" },
    ],
    ...(site.phone ? { telephone: site.phone.href.replace("tel:", "") } : {}),
    ...(site.email ? { email: site.email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Course (spec §7.3, §7.11): an online course with its offer. No AggregateRating: there are no reviews. */
export function courseLd(c: { name: string; description: string; path: string; price: number; free?: boolean; instance?: Record<string, unknown> }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.name,
    description: c.description,
    url: abs(c.path),
    provider: orgRef(),
    inLanguage: "en",
    offers: {
      "@type": "Offer",
      category: c.free ? "Free" : "Paid",
      price: c.price,
      priceCurrency: "USD",
      url: abs(c.path),
    },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", ...(c.instance ?? {}) },
  };
}

/** Person (spec §7.5): a teacher and the organisation they teach for. No ratings: there are none. */
export function personLd(p: { name: string; jobTitle: string; path: string; languages: readonly string[]; description?: string; image?: string; knowsAbout: string[] }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    jobTitle: p.jobTitle,
    url: abs(p.path),
    knowsLanguage: [...p.languages],
    ...(p.description ? { description: p.description } : {}),
    ...(p.image ? { image: abs(p.image) } : {}),
    worksFor: orgRef(),
    knowsAbout: p.knowsAbout,
  };
}

/** BreadcrumbList from the visible breadcrumb: every crumb with a link carries its URL; the current page is the last item. */
export function breadcrumbLd(items: readonly { label: string; href?: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: abs(item.href) } : {}),
    })),
  };
}

/** FAQPage: each question with its answer as plain text. */
export function faqPageLd(entries: readonly { q: string; text: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({ "@type": "Question", name: e.q, acceptedAnswer: { "@type": "Answer", text: e.text } })),
  };
}

/** ItemList of pages (catalog, directory). */
export function itemListLd(name: string, items: readonly { name: string; path: string; item?: Record<string, unknown> }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, ...(x.item ? { item: { ...x.item, url: abs(x.path) } } : { name: x.name, url: abs(x.path) }) })),
  };
}

/** The script body: JSON with "<" escaped, so it can never close the script element. */
export function jsonLdHtml(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
