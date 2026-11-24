import Link from "next/link";
import { EnrollFlow } from "@/components/enroll/EnrollFlow";
import { EnrollFooter, EnrollHeader } from "@/components/enroll/frame";
import { programs } from "@/content/pricing";
import { summerSeasonLine } from "@/components/enroll/season";
import { programTimetables, seasonState, upcomingYear } from "@/content/program-timetable";
import { LIVE_FORM_URL, parseEnrollParams } from "@/lib/enroll/params";
import { pageMetadata } from "@/lib/metadata";
import { enrollConfig } from "@/lib/server/enroll-wp";

/*
 * /enroll (spec §7.17; plan F:/iqu-setup/reports/enroll-shape-plan.md B3,
 * approved with the owner's decisions of 24 Nov 2026).
 * One template: monthly courses (?course=), ?aid=request, the Weekend
 * program and the Summer camp (?program=). Unknown values are ignored.
 * The server decides only what the browser cannot: whether online enrollment
 * is connected to WordPress, and whether the Summer season is open.
 */

// The template depends on ?program= and ?course=: render each request with them (as /courses does).
export const instant = false;

export const metadata = pageMetadata({
  title: "Enroll",
  description:
    "Enroll in live Quran classes with qualified teachers. Choose the course, the days and a time that suits your family. Your first month is free.",
  path: "/enroll",
});

export default async function EnrollPage({ searchParams }: PageProps<"/enroll">) {
  const params = parseEnrollParams(await searchParams);
  const config = enrollConfig();

  if (params.variant === "summer" && seasonState(programTimetables[programs.summer.id]) !== "open") {
    // Owner correction E: between seasons, only this line. No form that cannot be sent, no notify option.
    const year = upcomingYear(programTimetables[programs.summer.id]);
    return (
      <>
        <EnrollHeader />
        <main id="main-content" className="container-content flex-1 py-16">
          <h1 className="font-display text-heading-xl font-semibold text-ink">Summer Ilm Camp</h1>
          <p className="mt-4 text-body-lg text-ink-body">{year ? `${year} dates coming soon.` : "Dates coming soon."}</p>
          <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-body">
            <Link href={programs.summer.href} className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
              About the Summer Ilm Camp
            </Link>
            <Link href="/enroll" className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
              Enroll in monthly classes
            </Link>
          </p>
        </main>
        <EnrollFooter />
      </>
    );
  }

  return (
    <EnrollFlow
      params={params}
      connected={config !== null}
      siteKey={config?.recaptchaSiteKey ?? null}
      liveFormUrl={LIVE_FORM_URL[params.variant]}
      season={params.variant === "summer" ? summerSeasonLine() : undefined}
    />
  );
}
