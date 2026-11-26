import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { site } from "@/content/site";
import { PAPER } from "@/lib/brand-colors";
import { robotsFor, socialDefaults, TITLE_TEMPLATE } from "@/lib/metadata";
import { siteUrl } from "@/lib/site-env";
import "./globals.css";

/*
 * Font budget (CLAUDE.md §6, spec §9.3): marketing routes load two families
 * and use four weights: Newsreader 500/600 and IBM Plex Sans 400/500.
 * Both are self-hosted by next/font, subset to Latin, display: swap.
 * Newsreader loads as one variable file so it keeps its optical-size axis:
 * 64 px display type gets the high-contrast display cut that Riwāq is built
 * on. Only weights 500 and 600 are used.
 * IBM Plex Mono and the Arabic face are not loaded here.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-newsreader",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-sans",
});

/*
 * Defaults for every page. Pages build their own title, description,
 * canonical and social fields with pageMetadata() (src/lib/metadata.ts).
 * Icons come from the file conventions in this folder (favicon.ico, icon.png,
 * apple-icon.png, manifest.ts): the owner's final files (21 Nov 2026), used
 * exactly as supplied. Next.js adds a content hash to each link. Do not add
 * metadata.icons or manual <link rel="icon"> tags; they would conflict.
 * Staging and previews get <meta name="robots" content="noindex, nofollow">
 * on every page, besides the X-Robots-Tag header (next.config.ts).
 */
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: site.name,
    template: TITLE_TEMPLATE,
  },
  description: site.mission,
  applicationName: site.name,
  ...socialDefaults(site.name, site.mission),
  robots: robotsFor(),
};

// Zoom is never disabled (CLAUDE.md §4): no maximum-scale, no user-scalable.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: PAPER, // <meta name="theme-color">; viewport metadata cannot read CSS variables
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable}`}>
      {/* No MotionProvider here: only the pages that reveal wrap themselves in it,
          so /contact, /enroll and the 404 page load none of Motion (js-budget, 26 Nov 2026). */}
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
