import type { Metadata } from "next";
import { site } from "@/content/site";
import { isProductionSite } from "@/lib/site-env";

/*
 * Page metadata: title, description, canonical, Open Graph and Twitter.
 * Next.js replaces a parent's `openGraph` and `twitter` objects rather than
 * merging them, so every page builds its metadata here and the default image
 * is never lost. The root layout sets metadataBase (NEXT_PUBLIC_SITE_URL), so
 * the relative paths below resolve to absolute URLs.
 */

/** Applied by the root layout to every page title; Open Graph titles use the same form. */
export const TITLE_TEMPLATE = `%s · ${site.name}`;

/** The default social preview image: public/brand/og-image.jpg, 1200 × 630. */
export const OG_IMAGE = {
  url: "/brand/og-image.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Ilm-Ul-Quran USA — online Quran classes with qualified teachers",
} as const;

/** Search engines show about this many characters; longer descriptions are cut. */
export const MAX_DESCRIPTION = 160;

/**
 * Staging and previews: noindex, nofollow on every page, whatever the page
 * asks for (DEPLOYMENT.md). Production: the page's own robots, if any.
 */
export function robotsFor(robots?: Metadata["robots"]): Metadata["robots"] {
  if (!isProductionSite()) return { index: false, follow: false };
  return robots;
}

/** Open Graph and Twitter fields shared by every page (also the root layout's defaults). */
export function socialDefaults(title: string, description: string, url?: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      title,
      description,
      ...(url ? { url } : {}),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}

export function pageMetadata({
  title,
  description,
  path,
  robots,
}: {
  /** A page title (the template adds " · Ilm-Ul-Quran USA"), or { absolute } for the whole title. */
  title: string | { absolute: string };
  description: string;
  /** The page's path, e.g. "/courses/quran-hifz". Becomes the canonical and og:url. */
  path: string;
  robots?: Metadata["robots"];
}): Metadata {
  if (description.length > MAX_DESCRIPTION) {
    throw new Error(`Description for ${path} is ${description.length} characters (max ${MAX_DESCRIPTION}): ${description}`);
  }
  const fullTitle = typeof title === "string" ? TITLE_TEMPLATE.replace("%s", title) : title.absolute;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...socialDefaults(fullTitle, description, path),
    robots: robotsFor(robots),
  };
}
