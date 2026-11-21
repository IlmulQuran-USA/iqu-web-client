import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { PrintButton } from "@/components/portal/PrintButton";
import { courseById } from "@/content/pricing";
import { sampleReport as report } from "@/content/sample-parent";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/metadata";

/*
 * /preview/sample-report: a one-page monthly progress report with sample
 * data (owner, 21 Nov 2026; spec §7D.3 Reports: attendance, progress per
 * track, teacher comments, next-month targets). Linked from Home §6
 * ("See a sample report"). A printed page: it fits one A4 or Letter sheet.
 * noindex.
 */

export const metadata: Metadata = pageMetadata({
  title: "Sample monthly report (preview)",
  description:
    "A sample monthly progress report: attendance, progress in each part of the course, teacher comments and next month’s targets.",
  path: "/preview/sample-report",
  robots: { index: false, follow: false },
});

export default function SampleReport() {
  const { child, attendance: a } = report;
  const course = courseById(child.courseId);
  const percent = Math.round(((a.present + a.partial) / a.scheduled) * 100);
  const rows = [
    { label: "Classes scheduled", value: a.scheduled },
    { label: "Present", value: a.present },
    { label: "Partial", value: a.partial },
    { label: "Technical issue", value: a.technicalIssue },
    { label: "Student absent", value: a.studentAbsent },
    // Spec §7C.2: a teacher no-show is shown as clearly as a student absence.
    { label: "Teacher no-show", value: a.teacherNoShow },
    { label: "Class not held", value: a.classNotHeld },
  ];

  return (
    <main id="main-content" className="min-h-dvh bg-surface-2 px-4 py-6 sm:py-10 print:bg-paper print:p-0">
      {/* Way back to Home §6, and print or save as PDF (spec §7D.3). Not printed. */}
      <div className="mx-auto mb-4 flex max-w-200 flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/#progress-title"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Back to how progress is measured
        </Link>
        <PrintButton />
      </div>
      <article
        aria-labelledby="report-title"
        className="mx-auto max-w-200 rounded-card border border-rule bg-paper p-6 shadow-card sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <header className="flex flex-col gap-4 border-b border-ink pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo />
            <h1 id="report-title" className="mt-4 text-heading-xl font-medium">
              Monthly progress report
            </h1>
            <p className="mt-1 text-body text-ink-body">{report.month}</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
            <dt className="text-ink-muted">Student</dt>
            <dd className="font-medium text-ink">{child.name}</dd>
            <dt className="text-ink-muted">Course</dt>
            <dd className="text-ink">{course.label}</dd>
            <dt className="text-ink-muted">Teacher</dt>
            <dd className="text-ink" translate="no">
              {child.teacher.name}
            </dd>
            <dt className="text-ink-muted">Issued</dt>
            <dd className="text-ink">{report.issued}</dd>
          </dl>
        </header>

        <section aria-labelledby="att-title" className="mt-6">
          <h2 id="att-title" className="font-display text-heading-md font-semibold text-ink">
            Attendance
          </h2>
          <div className="mt-3 grid gap-6 sm:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="font-display text-display-md font-semibold text-ink tabular-nums">{percent}%</p>
              <p className="text-ui text-ink-body">classes attended (present or partial)</p>
              <p className="mt-3 text-ui text-ink-body tabular-nums">
                {a.verifiedMinutes} of {a.scheduledMinutes} minutes verified by Zoom
              </p>
            </div>
            <table className="w-full text-left text-ui">
              <caption className="sr-only">Attendance for {report.month}</caption>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-rule">
                    <th scope="row" className="py-2 font-normal text-ink-body">
                      {r.label}
                    </th>
                    <td className="py-2 text-right font-medium text-ink tabular-nums">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="lessons-title" className="mt-8">
          <h2 id="lessons-title" className="font-display text-heading-md font-semibold text-ink">
            Lessons covered
          </h2>
          {/* Phones: one block per week, so no track is cut off. */}
          <ol className="mt-3 flex flex-col divide-y divide-rule border-y border-rule sm:hidden print:hidden">
            {report.lessons.map((l) => (
              <li key={l.week} className="py-3">
                <p className="text-ui font-medium text-ink">{l.week}</p>
                <dl className="mt-1 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-ui">
                  <dt className="text-ink-muted">Sabaq</dt>
                  <dd className="text-ink">{l.sabaq}</dd>
                  <dt className="text-ink-muted">Sabqi</dt>
                  <dd className="text-ink-body">{l.sabqi}</dd>
                  <dt className="text-ink-muted">Manzil</dt>
                  <dd className="text-ink-body">{l.manzil}</dd>
                </dl>
              </li>
            ))}
          </ol>
          <div className="mt-3 hidden sm:block print:block">
            <table className="w-full text-left text-ui">
              <caption className="sr-only">Sabaq, Sabqi and Manzil by week</caption>
              <thead>
                <tr className="border-b border-ink text-ui-sm text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Week</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Sabaq (new lesson)</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Sabqi (recent)</th>
                  <th scope="col" className="py-2 font-medium">Manzil (older)</th>
                </tr>
              </thead>
              <tbody>
                {report.lessons.map((l) => (
                  <tr key={l.week} className="border-b border-rule align-top">
                    <th scope="row" className="py-2 pr-3 font-medium text-ink">
                      {l.week}
                    </th>
                    <td className="py-2 pr-3 text-ink">{l.sabaq}</td>
                    <td className="py-2 pr-3 text-ink-body">{l.sabqi}</td>
                    <td className="py-2 text-ink-body">{l.manzil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section aria-labelledby="note-title">
            <h2 id="note-title" className="font-display text-heading-md font-semibold text-ink">
              Teacher’s note
            </h2>
            <figure className="mt-3">
              <blockquote className="text-body text-pretty text-ink">
                <p>{report.teacherNote}</p>
              </blockquote>
              <figcaption className="mt-2 text-ui text-ink-muted" translate="no">
                {child.teacher.name}
              </figcaption>
            </figure>
          </section>
          <section aria-labelledby="goals-title">
            <h2 id="goals-title" className="font-display text-heading-md font-semibold text-ink">
              Goals for next month
            </h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-body text-ink marker:text-ink-muted">
              {report.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="mt-10 border-t border-rule pt-4 text-ui-sm text-ink-muted">
          <span translate="no">{site.name}</span> · {site.legalName} · {site.taxStatus}
        </footer>
      </article>
    </main>
  );
}
