import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { PAPER } from "@/lib/brand-colors";

/** /manifest.webmanifest. Icons: scripts/generate-icons.mjs. Colours: --paper (DESIGN.md §2). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "IQU",
    description: site.mission,
    start_url: "/",
    display: "browser",
    theme_color: PAPER,
    background_color: PAPER,
    icons: [
      { src: "/brand/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
