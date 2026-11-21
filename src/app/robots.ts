import type { MetadataRoute } from "next";

/**
 * /robots.txt: "User-agent: *" / "Allow: /" on every site, staging included.
 *
 * Staging (dev.ilmulquranus.org, previews) stays out of search through
 * noindex, not through robots.txt (DEPLOYMENT.md): every page carries
 * <meta name="robots" content="noindex, nofollow"> (src/lib/metadata.ts) and
 * every response the X-Robots-Tag header (next.config.ts). Google can only see
 * a noindex on a page it is allowed to crawl, and link-preview bots
 * (Facebook, WhatsApp, LinkedIn, X, Telegram, Slack) honour robots.txt, so a
 * Disallow would break link previews without keeping pages out of the index.
 *
 * No sitemap line yet: there is no sitemap, and staging never serves one.
 * Add it here for production at launch (DEPLOYMENT.md §7).
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
