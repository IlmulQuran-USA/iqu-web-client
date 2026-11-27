import type { NextConfig } from "next";
// The live WordPress URLs are redirected by src/proxy.ts (one 301 hop, with or
// without the trailing slash); only the file-like ones (sitemaps, icons) are
// here. The module imports only data modules, so the config loader can read it.
import { fileRedirects } from "./src/content/legacy-paths";
// Staging (dev.ilmulquranus.org) and previews must never be indexed. Anything
// but NEXT_PUBLIC_SITE_ENV=production is staging (DEPLOYMENT.md).
import { isProductionSite, NOINDEX_HEADER } from "./src/lib/site-env";

const productionSite = isProductionSite();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // `JS_BUDGET_SOURCEMAPS=1 npm run build` emits browser source maps, to see
  // which modules fill a chunk (scripts/js-budget.mjs). Off by default.
  productionBrowserSourceMaps: process.env.JS_BUDGET_SOURCEMAPS === "1",
  partialPrefetching: true,
  // Development only: lets the owner's phone load dev resources from this
  // machine over the LAN (http://192.168.0.94:3000). No effect in production.
  allowedDevOrigins: ["192.168.0.94"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // next/image only serves listed qualities: 75 (default) and 90 for the Home
  // dashboard screenshots, whose small UI text needs it (owner, 21 Nov 2026).
  images: { qualities: [75, 90] },
  // Trailing slashes are handled by src/proxy.ts: a live WordPress URL ("/about/")
  // gets ONE 301 to its final page; any other "/x/" gets the same 308 to "/x"
  // Next.js would give (src/lib/legacy-redirect.ts). Owner, 27 Nov 2026.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return fileRedirects(productionSite);
  },
  // Staging: X-Robots-Tag on every response, pages and static files alike.
  async headers() {
    if (productionSite) return [];
    return [{ source: "/:path*", headers: [NOINDEX_HEADER] }];
  },
  // Staging: no sitemap, even if one is added later. A rewrite to a path no
  // route matches answers 404 (the same trick as src/proxy.ts). beforeFiles
  // runs ahead of app/sitemap.ts and public/ files.
  async rewrites() {
    if (productionSite) return [];
    return {
      beforeFiles: [
        { source: "/:file(sitemap[^/]*\\.xml)", destination: "/_no-sitemap" },
        { source: "/sitemap/:path*", destination: "/_no-sitemap" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
