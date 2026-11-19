import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { site } from "@/content/site";
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

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.mission,
};

// Zoom is never disabled (CLAUDE.md §4): no maximum-scale, no user-scalable.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfcfa", // --paper; viewport metadata cannot read CSS variables
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
