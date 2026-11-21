import type { MetadataRoute } from "next";
import { isProductionSite } from "@/lib/site-env";

/**
 * /robots.txt. Staging and previews disallow everything (DEPLOYMENT.md); only
 * a build with NEXT_PUBLIC_SITE_ENV=production lets crawlers in. No sitemap
 * line: there is no sitemap yet, and staging never serves one.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/" } };
}
