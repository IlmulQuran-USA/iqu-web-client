import type { NextConfig } from "next";
// 301s from the live WordPress course URLs (COURSE-CONTENT.md §11, C6). The
// module imports only ./pricing, so the config loader can read it.
import { legacyCourseRedirects } from "./src/content/legacy-paths";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
  async redirects() {
    return legacyCourseRedirects();
  },
};

export default nextConfig;
