import { AttendanceStatusBadge } from "@/components/portal/AttendanceStatusBadge";
import { AppShell } from "@/components/portal/AppShell";
import { dayIn } from "@/components/portal/days";
import { longDateIn, timeWithZone } from "@/components/portal/format";
import { getData, type ClassSession, type Student } from "@/data";
import { requireArea } from "@/lib/auth/viewer";
import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/cn";

/*
 * /a/live: the admin's landing screen (spec §7D.6 "Live board", wireframe
 * A1). Batch 1: the day strip and today's classes grouped by teacher, each
 * with its state, read from the data layer. Times in Central Time (CT), with
 * the label. Contact, the session drawer and the flags come with the admin
 * screens (Batch 2).
 */

export const instant = false;

export const metadata = pageMetadata({
  title: "Live board",
  description: "Today's classes as they happen.",
  path: "/a/live",
  robots: { index: false, follow: false },
});

const ZONE = "America/Chicago";

function SessionLine({ s, student, now }: { s: ClassSession; student: Student | undefined; now: Date }) {
  const start = new Date(s.startsAt);
  const name = student ? `${student.firstName} ${student.lastName}` : "Student";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <span className="min-w-0">
        <span className="font-medium text-ink">{name}</span>
        <span className="text-ink-muted"> · {timeWithZone(start, ZONE)} · {s.minutes} min</span>
        {s.kind === "makeup" ? <span className="text-ink-muted"> · make-up</span> : null}
      </span>
      {s.state === "ended" && s.status ? (
        <AttendanceStatusBadge status={s.status} />
      ) : s.state === "in_progress" ? (
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-chip bg-success-tint px-2.5 text-ui font-medium text-success">
          Running · {Math.max(1, Math.round((now.getTime() - start.getTime()) / 60_000))} min
        </span>
      ) : (
        <span className="text-ui text-ink-muted">Upcoming</span>
      )}
    </li>
  );
}

export default async function LiveBoardPage() {
  const viewer = await requireArea("a", "/a/live");
  const data = getData();
  const now = new Date();
  const today = dayIn(ZONE, now);
  const [sessions, teachers, students] = await Promise.all([data.schedule.between(today.from, today.to), data.people.teachers(), data.people.students()]);
  const studentById = new Map(students.map((s) => [s.id, s]));

  const completed = sessions.filter((s) => s.state === "ended" && (s.status === "present" || s.status === "partial" || s.status === "technical-issue")).length;
  const running = sessions.filter((s) => s.state === "in_progress").length;
  const failed = sessions.filter((s) => s.status === "teacher-no-show" || s.status === "class-not-held").length;
  const tiles = [
    { label: "Scheduled today", value: sessions.length },
    { label: "Completed", value: completed },
    { label: "Running now", value: running },
    { label: "Failed", value: failed },
  ];

  return (
    <AppShell area="a" title="Live board" current="/a/live" account={viewer} preview={data.mode === "mock"}>
      <h1 className="font-display text-display-md font-medium text-ink">Live board</h1>
      <p className="mt-2 text-body text-ink-body">
        {longDateIn(now, ZONE)} · times in Central Time (CT)
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-card bg-surface p-5">
            <dt className="text-ui text-ink-muted">{t.label}</dt>
            <dd className={cn("mt-1 font-display text-display-md font-medium tabular-nums", t.label === "Failed" && t.value > 0 ? "text-danger" : "text-ink")}>
              {t.value}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-12 text-heading-lg text-ink">By teacher</h2>
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {teachers.map((t) => {
          const mine = sessions.filter((s) => s.teacherId === t.id);
          return (
            <li key={t.id} className="rounded-card border border-rule p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-sans text-body font-medium text-ink">{t.name}</h3>
                <span className="text-ui text-ink-muted">
                  {t.status === "setup" ? "Setting up · Zoom not linked" : mine.length ? `${mine.length} ${mine.length === 1 ? "class" : "classes"}` : "No class today"}
                </span>
              </div>
              {mine.length ? (
                <ul className="mt-2 divide-y divide-rule text-ui">
                  {mine.map((s) => (
                    <SessionLine key={s.id} s={s} student={studentById.get(s.studentId)} now={now} />
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
