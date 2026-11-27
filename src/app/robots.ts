import type { MetadataRoute } from "next";
import { robotsRules } from "@/content/sitemap";
import { isProductionSite, siteUrl } from "@/lib/site-env";

/**
 * /robots.txt (rules: src/content/sitemap.ts).
 *
 * Staging (dev.ilmulquranus.org, previews): "Disallow: /" (owner, 27 Nov
 * 2026), together with the noindex meta tag (src/lib/metadata.ts) and the
 * X-Robots-Tag header on every response (next.config.ts). Trade-off, accepted:
 * link-preview bots that honour robots.txt (Facebook, WhatsApp, LinkedIn…)
 * show no preview for dev links.
 *
 * Public site: allow all but /api/, /dev/ and /preview/, and the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return robotsRules(isProductionSite(), siteUrl().origin);
}
