import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/content/sitemap";
import { siteUrl } from "@/lib/site-env";

/**
 * /sitemap.xml: only built, indexable pages, each with its <lastmod>
 * (src/content/sitemap.ts). Served on the public site only: on staging
 * next.config.ts rewrites /sitemap*.xml to a 404 before this runs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(siteUrl().origin);
}
