import { CircleAlert, HeartHandshake } from "lucide-react";
import type { ReactNode } from "react";
import { courseById } from "@/content/pricing";
import { AttendanceStatusBadge } from "@/components/portal/AttendanceStatusBadge";
import { AppShell } from "@/components/portal/AppShell";
import { dateIn, hijriIn, longDateIn, shortDayIn, timeWithZone, usdCents, ymdText } from "@/components/portal/format";
import { getData, type BillingLine, type ClassSession, type Student, type Teacher } from "@/data";
import { requireArea } from "@/lib/auth/viewer";
import { pageMetadata } from "@/lib/metadata";

/*
 * /p/overview: the parent's landing screen (spec §7D.4 "Overview", wireframe
 * P1). Batch 1: one card per child (course, teacher, next class, this
 * month's classes), what needs the family's attention, and the family's
 * billing. Parents see each class's status and length, never the exact
 * minutes (owner, 27 Nov 2026). A fully funded child is shown with the
 * scholarship card, never a $0 line (spec §7D.3). No sibling discount
 * (PRODUCT decision 2). The rest of the parent portal comes in Batch 3.
 */

export const instant = false;

export const metadata = pageMetadata({
  title: "Overview",
  description: "Your children's classes, attendance and billing.",
  path: "/p/overview",
  robots: { index: false, follow: false },
});

const DAY = 86_400_000;

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-rule p-5 sm:p-6 ${className}`}>{children}</section>;
}

function ChildCard({ child, teacher, sessions, zone, now }: { child: Student; teacher: Teacher | null; sessions: ClassSession[]; zone: string; now: Date }) {
  const next = sessions.find((s) => s.state !== "ended");
  const past = sessions.filter((s) => s.state === "ended");
  const recent = past.slice(-5).reverse();
  const monthStart = `${dateIn(now, zone).split(" ").slice(1).join(" ")}`;
  const thisMonth = past.filter((s) => dateIn(new Date(s.startsAt), zone).endsWith(monthStart));
  const present = thisMonth.filter((s) => s.status === "present").length;
  const course = child.courseId ? courseById(child.courseId).label : "Weekend Ilm Program";

  return (
    <Card>
      <h2 className="text-heading-lg text-ink">
        {child.firstName}, {child.age}
      </h2>
      <p className="mt-1 text-body text-ink-body">
        {course} · {child.daysPerWeek} {child.daysPerWeek === 1 ? "day" : "days"} a week · {child.minutes} min
      </p>
      {teacher ? <p className="text-ui text-ink-muted">Teacher: {teacher.name}</p> : null}

      <div className="mt-5 rounded-card bg-surface-2 p-4">
        <p className="text-ui text-ink-muted">Next class</p>
        {next ? (
          <p className="mt-1 font-medium text-ink">
            {next.state === "in_progress" ? "In progress now" : shortDayIn(new Date(next.startsAt), zone)} · {timeWithZone(new Date(next.startsAt), zone)} · {next.minutes} min
            {next.kind === "makeup" ? " · make-up class" : ""}
          </p>
        ) : (
          <p className="mt-1 text-ink-body">No class scheduled in the next two weeks.</p>
        )}
      </div>

      <p className="mt-5 text-ui text-ink-muted">This month</p>
      <p className="mt-1 text-body text-ink">
        {thisMonth.length ? `${present} of ${thisMonth.length} classes present` : "No classes yet this month"}
      </p>

      {recent.length ? (
        <>
          <h3 className="mt-5 font-sans text-ui font-medium text-ink-muted">Recent classes</h3>
          <ul className="mt-2 divide-y divide-rule text-ui">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="text-ink-body">
                  {shortDayIn(new Date(s.startsAt), zone)} · {timeWithZone(new Date(s.startsAt), zone)} · {s.minutes} min
                  {s.kind === "makeup" ? " · make-up" : ""}
                </span>
                {s.status ? <AttendanceStatusBadge status={s.status} /> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}

function LineRow({ line, name }: { line: BillingLine; name: string }) {
  const course = courseById(line.courseId).label;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <span>
        <span className="font-medium text-ink">{name}</span>
        <span className="text-ink-body">
          {" "}
          · {course} · {line.daysPerWeek} days a week
        </span>
        {line.help && line.help.level !== "full" ? (
          <span className="block text-ui text-ink-muted">
            Help with fees: {line.help.level}% off the full fee of {usdCents(line.fullCents)}
          </span>
        ) : null}
      </span>
      <span className="font-medium text-ink tabular-nums">{usdCents(line.monthlyCents)} a month</span>
    </li>
  );
}

export default async function ParentOverviewPage() {
  const viewer = await requireArea("p", "/p/overview");
  const data = getData();
  const now = new Date();
  const familyId = viewer.familyId ?? "";
  const [family, children, billing, teachers] = await Promise.all([
    data.people.family(familyId),
    data.people.studentsOfFamily(familyId),
    data.billing.forFamily(familyId),
    data.people.teachers(),
  ]);
  const zone = family?.zone ?? "America/Chicago";
  const from = new Date(now.getTime() - 35 * DAY);
  const to = new Date(now.getTime() + 14 * DAY);
  const sessionsOf = await Promise.all(children.map((c) => data.schedule.forStudent(c.id, from, to)));

  // What needs the family's attention: a teacher who did not come in the last two weeks (and its make-up), a payment problem.
  const attention: string[] = [];
  children.forEach((child, i) => {
    for (const s of sessionsOf[i]) {
      if (s.status !== "teacher-no-show" || now.getTime() - new Date(s.startsAt).getTime() > 14 * DAY) continue;
      const makeup = sessionsOf[i].find((m) => m.kind === "makeup" && m.startsAt > s.startsAt);
      attention.push(
        `${child.firstName}’s class on ${shortDayIn(new Date(s.startsAt), zone)} was recorded as a teacher no-show. ` +
          (makeup
            ? `A make-up class ${makeup.state === "ended" ? "was held" : "is booked"} on ${shortDayIn(new Date(makeup.startsAt), zone)} at ${timeWithZone(new Date(makeup.startsAt), zone)}.`
            : "Our team will contact you about a make-up class."),
      );
    }
  });
  if (billing?.status === "past_due") attention.push("Your last payment didn’t go through. Please update your payment method.");

  const firstName = (family?.guardianName ?? viewer.name).split(" ")[0];
  const nameOf = (id: string) => children.find((c) => c.id === id)?.firstName ?? "";
  const paid = billing?.lines.filter((l) => l.monthlyCents > 0) ?? [];
  const funded = billing?.lines.filter((l) => l.help?.level === "full") ?? [];

  return (
    <AppShell area="p" title="Overview" current="/p/overview" account={viewer} preview={data.mode === "mock"}>
      <h1 className="font-display text-display-md font-medium text-ink">As-salamu alaykum, {firstName}</h1>
      <p className="mt-2 text-body text-ink-body">
        {longDateIn(now, zone)} · {hijriIn(now, zone)}
      </p>

      {attention.length ? (
        <section aria-labelledby="attention" className="mt-8 rounded-card bg-warning-tint p-5">
          <h2 id="attention" className="flex items-center gap-2 font-sans text-body font-medium text-ink">
            <CircleAlert aria-hidden="true" strokeWidth={1.5} className="size-5 text-warning" />
            Needs your attention
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-7 text-ui text-ink-body">
            {attention.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {children.map((child, i) =>
          child.status === "archived" ? null : (
            <ChildCard key={child.id} child={child} teacher={teachers.find((t) => t.id === child.teacherId) ?? null} sessions={sessionsOf[i]} zone={zone} now={now} />
          ),
        )}
      </div>

      {billing ? (
        <Card className="mt-8">
          <h2 className="text-heading-lg text-ink">Billing</h2>
          {paid.length ? (
            <>
              <ul className="mt-2 divide-y divide-rule">
                {paid.map((l) => (
                  <LineRow key={l.studentId} line={l} name={nameOf(l.studentId)} />
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 border-t border-ink pt-3 text-body">
                <span className="font-medium text-ink">Monthly total</span>
                <span className="font-medium text-ink tabular-nums">{usdCents(billing.monthlyCents)}</span>
              </p>
              <p className="mt-3 text-ui text-ink-body">
                {billing.nextChargeOn ? `Next payment on ${ymdText(billing.nextChargeOn)}` : "No payment is scheduled"}
                {billing.method ? ` · ${billing.method.brand} ending ${billing.method.last4}` : ""}
              </p>
            </>
          ) : null}
          {funded.map((l) => (
            <div key={l.studentId} className="mt-4 flex gap-3 rounded-card bg-surface-2 p-4">
              <HeartHandshake aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-accent-strong" />
              <div className="text-ui">
                <p className="font-medium text-ink">{l.help?.fund === "zakat" ? "Zakat scholarship" : "Scholarship"}</p>
                <p className="mt-1 text-ink-body">
                  {nameOf(l.studentId)}’s classes are fully funded by our {l.help?.fund === "zakat" ? "Zakat " : ""}scholarship fund. There is nothing to pay.
                </p>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </AppShell>
  );
}
