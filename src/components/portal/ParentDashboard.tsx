import { ArrowRight, Clock, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchFrame } from "@/components/ui/ArchFrame";
import { courseById } from "@/content/pricing";
import {
  parentDashboardSample as family,
  type Child,
} from "@/content/sample-parent";
import { cn } from "@/lib/cn";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";

/*
 * Parent dashboard (spec §7D.4 Overview and child detail; owner, 21 Nov
 * 2026), with sample data (src/content/sample-parent.ts). Operate surface:
 * the week at a glance, scannable, quiet. System facts (statuses, verified
 * minutes) are read-only text, never inputs (CLAUDE.md §4). Only the six
 * attendance statuses appear. No join button here: the portal shows the
 * class link 10 minutes before a class (spec §7D.3).
 */

export const childHref = (id: string) =>
  id === family.children[0].id
    ? "/preview/parent-dashboard"
    : `/preview/parent-dashboard/${id}`;

function Card({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-card border border-rule bg-paper p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-heading-md font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-chip text-ui font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
    >
      {children}
      <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
    </Link>
  );
}

function TeacherArch({
  child,
  size = "w-12",
}: {
  child: Child;
  size?: string;
}) {
  const t = child.teacher;
  return (
    <span className={cn("block shrink-0", size)}>
      {t.photo ? (
        <ArchFrame
          name={t.name}
          decorative
          src={t.photo.src}
          width={t.photo.width}
          height={t.photo.height}
          focalPoint={{ x: 50, y: 50 }}
          sizes="48px"
          loading="eager"
        />
      ) : (
        <ArchFrame name={t.name} decorative />
      )}
    </span>
  );
}

const verified = (child: Child) => {
  const done = child.week.filter((c) => c.verifiedMinutes !== null);
  return {
    minutes: done.reduce((sum, c) => sum + (c.verifiedMinutes ?? 0), 0),
    scheduled: done.reduce((sum, c) => sum + c.scheduledMinutes, 0),
  };
};

/* ── One child ───────────────────────────────────────────────────────────── */

export function ChildDashboard({ child }: { child: Child }) {
  const course = courseById(child.courseId);
  const week = verified(child);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-heading-xl font-medium text-balance md:text-display-md">
          {child.name}’s week
        </h1>
        <p className="mt-2 text-body text-ink-body">
          {course.label} · {child.daysPerWeek} days a week · {child.minutes}{" "}
          minutes · with <span translate="no">{child.teacher.name}</span>
        </p>
      </div>

      {/* Two columns from lg, each a stack, so no card stretches to its neighbour's height. */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Next class: the most prominent card (spec §7D.3 NextClassCard). The page's one --tint. */}
          <section
            aria-label="Next class"
            className="rounded-card bg-tint p-5 sm:p-6"
          >
            <h2 className="font-sans text-ui font-medium text-ink-body">
              Next class
            </h2>
            <p className="mt-3 font-display text-heading-xl font-semibold text-ink md:text-display-md">
              {child.nextClass.date}
            </p>
            <p className="mt-1 font-display text-heading-lg font-semibold text-ink tabular-nums">
              {child.nextClass.time}
            </p>
            {/* The teacher on --paper: an arch monogram is never on --tint (DESIGN.md §7). */}
            <div className="mt-5 flex items-center gap-3 rounded-card bg-paper p-3">
              <TeacherArch child={child} />
              <p className="text-ui">
                <span className="block font-medium text-ink" translate="no">
                  {child.teacher.name}
                </span>
                <span className="block text-ink-body">
                  {course.label} · {child.minutes} minutes
                </span>
              </p>
            </div>
            <p className="mt-5 flex items-start gap-2 text-ui text-ink-body">
              <Clock
                aria-hidden="true"
                strokeWidth={1.5}
                className="mt-0.5 size-4 shrink-0 text-ink-muted"
              />
              The class link appears here 10 minutes before the class. Times are
              in your time zone ({family.zone}).
            </p>
          </section>

          <Card
            title="This week"
            action={
              <span className="text-ui text-ink-muted tabular-nums">
                {week.minutes} of {week.scheduled} min verified
              </span>
            }
          >
            <table className="w-full text-left">
              <caption className="sr-only">
                {child.name}’s classes this week, with attendance status and
                verified minutes
              </caption>
              <thead>
                <tr className="border-b border-rule text-ui-sm text-ink-muted">
                  <th scope="col" className="pb-2 font-medium">
                    Class
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="hidden pb-2 text-right font-medium sm:table-cell"
                  >
                    Verified
                  </th>
                </tr>
              </thead>
              <tbody>
                {child.week.map((c) => (
                  <tr
                    key={c.day}
                    className="border-b border-rule last:border-b-0"
                  >
                    <th scope="row" className="py-3 pr-3 align-top font-normal">
                      <span className="block text-ui font-medium whitespace-nowrap text-ink">
                        {c.day}
                      </span>
                      <span className="block text-ui-sm text-ink-muted tabular-nums">
                        {c.time}
                      </span>
                    </th>
                    <td className="py-3 pr-3 align-top">
                      {c.status ? (
                        <AttendanceStatusBadge status={c.status} />
                      ) : (
                        <span className="text-ui text-ink-muted">Upcoming</span>
                      )}
                      {/* Spec §7C.2: a technical issue is not an absence; a make-up is offered. */}
                      {c.status === "technical-issue" ? (
                        <span className="mt-1 block text-ui-sm text-ink-body">Make-up class offered</span>
                      ) : null}
                      {/* Phones: the minutes sit under the badge instead of in their own column. */}
                      <span className="mt-1 block text-ui-sm text-ink-body tabular-nums sm:hidden">
                        {c.verifiedMinutes === null
                          ? ""
                          : `${c.verifiedMinutes} of ${c.scheduledMinutes} min verified`}
                      </span>
                    </td>
                    <td className="hidden py-3 text-right align-top text-ui whitespace-nowrap text-ink tabular-nums sm:table-cell">
                      {c.verifiedMinutes === null
                        ? "–"
                        : `${c.verifiedMinutes} of ${c.scheduledMinutes} min`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 flex items-start gap-2 text-ui-sm text-ink-muted">
              <Info
                aria-hidden="true"
                strokeWidth={1.5}
                className="mt-0.5 size-4 shrink-0"
              />
              Verified minutes are measured by Zoom: the time {child.name} and
              the teacher were in class together.
            </p>
            {/* Spec §7C.6: any family can report a problem with a class. */}
            <TextLink href="/p/report-a-problem">Was there a problem with a class?</TextLink>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <ProgressCard child={child} />
          <Card title="Latest teacher note">
            <figure>
              <blockquote className="text-body text-pretty text-ink">
                <p>{child.note.text}</p>
              </blockquote>
              <figcaption className="mt-3 text-ui text-ink-muted">
                <span translate="no">{child.teacher.name}</span> ·{" "}
                {child.note.date}
              </figcaption>
            </figure>
          </Card>

          <Card title={`${child.month.label} attendance`}>
            <p className="font-display text-heading-xl font-semibold text-ink tabular-nums">
              {child.month.attended} of {child.month.scheduled}
              <span className="ml-2 font-sans text-body font-normal text-ink-body">
                classes attended
              </span>
            </p>
            <p className="mt-2 text-ui-sm text-ink-muted">
              Sick days and approved leave are not counted against {child.name}
              {child.month.excused > 0
                ? ` (${child.month.excused} this month)`
                : ""}
              .
            </p>
          </Card>
        </div>

        <BillingCard className="lg:col-span-12" />
      </div>
    </div>
  );
}

function ProgressCard({
  child,
  className,
}: {
  child: Child;
  className?: string;
}) {
  const p = child.progress;
  if (p.kind === "hifz") {
    return (
      <Card title="Hifz progress" className={className}>
        <p className="text-body text-ink">
          Working on <span className="font-medium">Juz {p.juzCurrent}</span> ·{" "}
          <span className="tabular-nums">{p.juzDone.length} of 30</span> juz memorized
        </p>
        {/* 30-cell juz grid (spec §7D.3 Progress), read-only. Hifz usually starts at Juz 30. */}
        <ol aria-label="Juz memorized" className="mt-3 grid grid-cols-10 gap-1">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
            const done = p.juzDone.includes(juz);
            const current = juz === p.juzCurrent;
            return (
              <li
                key={juz}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-chip text-ui-xs tabular-nums",
                  done && "bg-ink text-paper",
                  current &&
                    "border-2 border-accent-strong font-medium text-ink",
                  !done && !current && "bg-surface text-ink-muted",
                )}
              >
                {juz}
                {/* The state as text: screen readers often skip aria-label on a list item. */}
                <span className="sr-only">{done ? ", memorized" : current ? ", in progress" : ""}</span>
              </li>
            );
          })}
        </ol>
        <p aria-hidden="true" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ui-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-chip bg-ink" /> Memorized
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-chip border-2 border-accent-strong" /> In progress
          </span>
        </p>
        <h3 className="mt-5 font-sans text-ui font-medium text-ink-body">
          Latest lesson · {child.week.filter((c) => c.status).at(-1)?.day ?? ""}
        </h3>
        <dl className="mt-2 divide-y divide-rule border-y border-rule">
          {[
            { term: "Sabaq", gloss: "new lesson", value: p.sabaq },
            { term: "Sabqi", gloss: "recent lessons", value: p.sabqi },
            { term: "Manzil", gloss: "older portions", value: p.manzil },
          ].map((row) => (
            <div
              key={row.term}
              className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5"
            >
              <dt className="text-ui">
                <span className="block font-medium text-ink">{row.term}</span>
                <span className="block text-ui-sm text-ink-muted">
                  {row.gloss}
                </span>
              </dt>
              <dd className="self-center text-ui text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  }
  const percent = Math.round((p.currentClass / p.totalClasses) * 100);
  return (
    <Card title="Course progress" className={className}>
      <p className="text-body text-ink">
        <span className="font-medium tabular-nums">
          Class {p.currentClass} of {p.totalClasses}
        </span>
      </p>
      <div
        role="img"
        aria-label={`${percent}% of the class plan`}
        className="mt-3 h-2 overflow-hidden rounded-pill bg-surface"
      >
        <div
          className="h-full rounded-pill bg-ink"
          style={{ width: `${percent}%` }}
        />
      </div>
      <dl className="mt-5 divide-y divide-rule border-y border-rule">
        <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5">
          <dt className="text-ui font-medium text-ink">Now learning</dt>
          <dd className="text-ui text-ink">{p.focus}</dd>
        </div>
        <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5">
          <dt className="text-ui font-medium text-ink">Next checkpoint</dt>
          <dd className="text-ui text-ink">{p.nextCheckpoint}</dd>
        </div>
      </dl>
    </Card>
  );
}

function BillingCard({ className }: { className?: string }) {
  const b = family.billing;
  return (
    <Card
      title="Billing"
      className={className}
      action={<TextLink href="/p/billing">Billing details</TextLink>}
    >
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-ui-sm text-ink-muted">Next billing date</dt>
            <dd className="mt-1 font-display text-heading-md font-semibold text-ink">
              {b.nextDate}
            </dd>
          </div>
          <div>
            <dt className="text-ui-sm text-ink-muted">Amount</dt>
            <dd className="mt-1 font-display text-heading-md font-semibold text-ink tabular-nums">
              {b.total}
            </dd>
          </div>
          <div>
            <dt className="text-ui-sm text-ink-muted">Payment method</dt>
            <dd className="mt-1 text-ui text-ink">{b.method}</dd>
          </div>
          <div>
            <dt className="text-ui-sm text-ink-muted">Last payment</dt>
            <dd className="mt-1 text-ui text-ink">{b.lastPayment}</dd>
          </div>
        </dl>
        <table className="w-full self-start text-left">
          <caption className="sr-only">Monthly fee for each child</caption>
          <tbody>
            {b.lines.map((line) => (
              <tr key={line.child} className="border-b border-rule">
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-ui font-normal text-ink"
                >
                  {line.child} ·{" "}
                  <span className="text-ink-body">{line.course}</span>
                </th>
                <td className="py-2.5 text-right text-ui text-ink tabular-nums">
                  {line.feeLabel}/month
                </td>
              </tr>
            ))}
            <tr>
              <th
                scope="row"
                className="pt-2.5 pr-3 text-ui font-medium text-ink"
              >
                Total each month
              </th>
              <td className="pt-2.5 text-right text-ui font-medium text-ink tabular-nums">
                {b.total}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── All children (spec §7D.4 Overview: one row per child) ───────────────── */

export function AllChildren() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-heading-xl font-medium md:text-display-md">
          Your children
        </h1>
        <p className="mt-2 text-body text-ink-body">
          This week at a glance. Open a child for the full week.
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {family.children.map((child) => {
          const course = courseById(child.courseId);
          const alerts = child.week.filter(
            (c) =>
              c.status === "student-absent" || c.status === "teacher-no-show",
          );
          return (
            <li
              key={child.id}
              className="rounded-card border border-rule p-5 sm:p-6"
            >
              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  {/* The child's own initial; the arch is reserved for teachers. */}
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface font-display text-body-lg font-semibold text-ink-body"
                  >
                    {child.name.charAt(0)}
                  </span>
                  <div>
                    <h2 className="font-display text-heading-md font-semibold text-ink">
                      {child.name}, {child.age}
                    </h2>
                    <p className="text-ui text-ink-body">
                      {course.label} ·{" "}
                      <span translate="no">{child.teacher.name}</span>
                    </p>
                  </div>
                </div>
                <dl className="text-ui">
                  <dt className="text-ink-muted">Next class</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {child.nextClass.date}, {child.nextClass.time}
                  </dd>
                </dl>
                <dl className="text-ui">
                  <dt className="text-ink-muted">{child.month.label}</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {child.month.attended} of {child.month.scheduled} classes
                    attended
                  </dd>
                  {alerts.length > 0 ? (
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {alerts.map((a) => (
                        <span
                          key={a.day}
                          className="inline-flex items-center gap-1.5"
                        >
                          <AttendanceStatusBadge status={a.status!} />
                          <span className="text-ui-sm text-ink-muted">
                            {a.day}
                          </span>
                        </span>
                      ))}
                    </dd>
                  ) : null}
                </dl>
                <TextLink href={childHref(child.id)}>
                  Open {child.name}’s week
                </TextLink>
              </div>
            </li>
          );
        })}
      </ul>
      <BillingCard />
    </div>
  );
}
