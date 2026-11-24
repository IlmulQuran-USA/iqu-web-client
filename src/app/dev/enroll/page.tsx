import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnrollFlow } from "@/components/enroll/EnrollFlow";
import { summerSeasonLine } from "@/components/enroll/season";
import { LIVE_FORM_URL, parseEnrollParams } from "@/lib/enroll/params";
import { pageMetadata } from "@/lib/metadata";

/*
 * Development only: /enroll with the Summer season forced open, for QA while
 * the real route says "2027 dates coming soon" (owner correction E). It is
 * never connected to WordPress, so Review shows the not-connected state.
 * 404 in production builds, like the other /dev pages.
 */

export const instant = false;

export const metadata: Metadata = pageMetadata({
  title: "Enroll preview",
  description: "Development preview of the enrollment form.",
  path: "/dev/enroll",
  robots: { index: false, follow: false },
});

export default async function EnrollPreview({ searchParams }: PageProps<"/dev/enroll">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = parseEnrollParams(await searchParams);
  const season = summerSeasonLine();
  return (
    <EnrollFlow
      params={params}
      connected={false}
      siteKey={null}
      liveFormUrl={LIVE_FORM_URL[params.variant]}
      season={season ? { ...season, title: `${season.title} (preview: last season's dates)` } : undefined}
    />
  );
}
