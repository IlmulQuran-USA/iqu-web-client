import { courseById } from "@/content/pricing";
import { AttendanceStatusBadge } from "@/components/portal/AttendanceStatusBadge";
import { AppShell } from "@/components/portal/AppShell";
import { weekIn } from "@/components/portal/days";
import { hijriIn, longDateIn, shortDayIn, timeWithZone, untilText, usdCents, ymdText } from "@/components/portal/format";
import { getData } from "@/data";
import { requireArea } from "@/lib/auth/viewer";
import { pageMetadata } from "@/lib/metadata";

/*
 * /s/overview: the adult learner's landing screen (spec §7D.3 "Overview",
 * wireframe S1). Batch 1: greeting with the Gregorian and Hijri date, the
 * next class (course, teacher, time in her zone with its label, how soon),
 * this week's classes with their status, and her own billing. The join
 * button, progress, homework and reports come with the student portal
 * (Batch 4).
 */

export const instant = false;

export const metadata = pageMetadata({
  title: "Overview",
  description: "Your next class, this week and your plan.",
  path: "/s/overview",
  robots: { index: false, follow: false },
});

const DAY = 86_400_000;

export default async function StudentOverviewPage() {
  const viewer = await requireArea("s", "/s/overview");
  const data = getData();
  const now = new Date();
  const student = viewer.studentId ? await data.people.student(viewer.studentId) : null;
  const zone = student?.zone ?? "America/New_York";
  const week = weekIn(zone, now);
  const [teacher, upcoming, thisWeek, billing] = await Promise.all([
    student?.teacherId ? data.people.teacher(student.teacherId) : Promise.resolve(null),
    student ? data.schedule.forStudent(student.id, new Date(now.getTime() - DAY), new Date(now.getTime() + 14 * DAY)) : Promise.resolve([]),
    student ? data.schedule.forStudent(student.id, week.from, week.to) : Promise.resolve([]),
    viewer.familyId ? data.billing.forFamily(viewer.familyId) : Promise.resolve(null),
  ]);
  const next = upcoming.find((s) => s.state !== "ended");
  const course = student?.courseId ? courseById(student.courseId).label : "";
  const firstName = viewer.name.split(" ")[0];

  return (
    <AppShell area="s" title="Overview" current="/s/overview" account={viewer} preview={data.mode === "mock"}>
      <h1 className="font-display text-display-md font-medium text-ink">As-salamu alaykum, {firstName}</h1>
      <p className="mt-2 text-body text-ink-body">
        {longDateIn(now, zone)} · {hijriIn(now, zone)}
      </p>

      <section aria-labelledby="next-class" className="mt-8 rounded-card bg-surface p-5 sm:p-6">
        <h2 id="next-class" className="font-sans text-ui font-medium text-ink-muted">
          Next class
        </h2>
        {next ? (
          <>
            <p className="mt-2 font-display text-heading-lg text-ink">{course}</p>
            {teacher ? <p className="mt-1 text-body text-ink-body">{teacher.name}</p> : null}
            <p className="mt-3 text-body font-medium text-ink">
              {next.state === "in_progress" ? "In progress now" : `${shortDayIn(new Date(next.startsAt), zone)} · ${timeWithZone(new Date(next.startsAt), zone)}`}
              <span className="font-normal text-ink-body"> · {next.minutes} min</span>
            </p>
            {next.state === "upcoming" ? <p className="mt-1 text-ui text-ink-muted">Starts {untilText(now, new Date(next.startsAt))}</p> : null}
          </>
        ) : (
          <p className="mt-2 text-body text-ink-body">No class scheduled in the next two weeks.</p>
        )}
      </section>

      <section aria-labelledby="this-week" className="mt-8">
        <h2 id="this-week" className="text-heading-lg text-ink">
          This week
        </h2>
        {thisWeek.length ? (
          <ul className="mt-3 divide-y divide-rule rounded-card border border-rule px-5 text-ui">
            {thisWeek.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="text-ink-body">
                  {shortDayIn(new Date(s.startsAt), zone)} · {timeWithZone(new Date(s.startsAt), zone)} · {s.minutes} min
                </span>
                {s.state === "ended" && s.status ? (
                  <AttendanceStatusBadge status={s.status} />
                ) : s.state === "in_progress" ? (
                  <span className="text-ink">In progress</span>
                ) : (
                  <span className="text-ink-muted">Upcoming</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-card bg-surface p-5 text-body text-ink-body">No classes this week.</p>
        )}
      </section>

      {billing && student ? (
        <section aria-labelledby="plan" className="mt-8 rounded-card border border-rule p-5 sm:p-6">
          <h2 id="plan" className="text-heading-lg text-ink">
            Your plan
          </h2>
          <p className="mt-2 text-body text-ink-body">
            {course} · {student.daysPerWeek} {student.daysPerWeek === 1 ? "day" : "days"} a week · {student.minutes} min
          </p>
          <p className="mt-1 text-body font-medium text-ink tabular-nums">{usdCents(billing.monthlyCents)} a month</p>
          <p className="mt-3 text-ui text-ink-body">
            {billing.nextChargeOn ? `Next payment on ${ymdText(billing.nextChargeOn)}` : "No payment is scheduled"}
            {billing.method ? ` · ${billing.method.brand} ending ${billing.method.last4}` : ""}
          </p>
        </section>
      ) : null}
    </AppShell>
  );
}
