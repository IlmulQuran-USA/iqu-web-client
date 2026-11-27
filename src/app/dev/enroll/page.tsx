import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnrollFlow } from "@/components/enroll/EnrollFlow";
import { summerSeasonLine } from "@/components/enroll/season";
import { parseEnrollParams } from "@/lib/enroll/params";
import { enrollPreview } from "@/lib/server/enroll/config";
import { pageMetadata } from "@/lib/metadata";

/*
 * Development only: /enroll with the Summer season forced open, for QA while
 * the real route says "2027 dates coming soon" (owner correction E). It is
 * sends through the dev preview's mock adapter when it is on (nothing saved,
 * sent or charged); otherwise Review says sending is being set up.
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
      connected={enrollPreview()}
      siteKey={null}
      season={season ? { ...season, title: `${season.title} (preview: last season's dates)` } : undefined}
    />
  );
}
