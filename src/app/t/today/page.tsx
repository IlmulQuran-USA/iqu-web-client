import { TriangleAlert } from "lucide-react";
import { courseById } from "@/content/pricing";
import { AttendanceStatusBadge } from "@/components/portal/AttendanceStatusBadge";
import { AppShell } from "@/components/portal/AppShell";
import { dayIn, dstChangeSoon } from "@/components/portal/days";
import { dateIn, longDateIn, timeIn, timeWithZone, untilText, zoneLabelIn } from "@/components/portal/format";
import { getData } from "@/data";
import { requireArea } from "@/lib/auth/viewer";
import { pageMetadata } from "@/lib/metadata";

/*
 * /t/today: the teacher's landing screen (spec §7D.5 "Today", wireframe T1),
 * reduced scope (owner, 27 Nov 2026): schedule, students and progress only.
 * Teachers keep posting class updates in Telegram with /classformat, and
 * Telegram + Google Sheets stay the record of attendance and salary, so this
 * page has no class record, no attendance entry and no reminders of its own.
 * Every time shows in Dhaka first, with the student's own time beside it
 * (DualClock), and a banner warns in the two weeks before a North American
 * clock change.
 */

export const instant = false;

export const metadata = pageMetadata({
  title: "Today",
  description: "Today's classes, in Dhaka time with each student's time beside it.",
  path: "/t/today",
  robots: { index: false, follow: false },
});

const DHAKA = "Asia/Dhaka";

export default async function TeacherTodayPage() {
  const viewer = await requireArea("t", "/t/today");
  const data = getData();
  const now = new Date();
  const today = dayIn(DHAKA, now);
  const teacherId = viewer.teacherId ?? "";
  const [sessions, students, teacher] = await Promise.all([
    data.schedule.forTeacher(teacherId, today.from, today.to),
    data.people.studentsOfTeacher(teacherId),
    data.people.teacher(teacherId),
  ]);
  const byId = new Map(students.map((s) => [s.id, s]));
  const done = sessions.filter((s) => s.state === "ended").length;
  const live = sessions.filter((s) => s.state === "in_progress").length;
  const dst = dstChangeSoon(now);
  const firstName = (teacher?.name ?? viewer.name).split(" ").slice(1, 2)[0] ?? viewer.name;

  return (
    <AppShell area="t" title="Today" current="/t/today" account={viewer} preview={data.mode === "mock"}>
      <h1 className="font-display text-display-md font-medium text-ink">As-salamu alaykum, {firstName}</h1>
      <p className="mt-2 text-body text-ink-body">
        {longDateIn(now, DHAKA)} · Dhaka {timeIn(now, DHAKA)} · Central (US) {timeWithZone(now, "America/Chicago")}
      </p>

      {dst ? (
        <div className="mt-6 flex gap-3 rounded-card bg-warning-tint p-4 text-ui">
          <TriangleAlert aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-ink">
            <span className="font-medium">US clocks change on {dateIn(dst, "America/New_York")}.</span> From that day, class times in Dhaka move by one hour.
          </p>
        </div>
      ) : null}

      <h2 className="mt-10 text-heading-lg text-ink">Today’s classes</h2>
      <p className="mt-1 text-ui text-ink-muted">
        {sessions.length} {sessions.length === 1 ? "class" : "classes"} · {done} completed · {live} in progress
      </p>

      {sessions.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface p-6 text-body text-ink-body">No classes today.</p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {sessions.map((s) => {
            const student = byId.get(s.studentId);
            const start = new Date(s.startsAt);
            const zone = student?.zone ?? "America/Chicago";
            const subject = s.courseId ? courseById(s.courseId).label : (student?.group ?? "Weekend Ilm Program");
            return (
              <li key={s.id} className="rounded-card border border-rule p-5">
                <p className="font-medium text-ink">
                  {student ? `${student.firstName} ${student.lastName}` : "Student"}
                  <span className="font-normal text-ink-muted"> · {subject}</span>
                </p>
                <p className="mt-1 text-ui text-ink-body">
                  <span className="font-medium text-ink">{timeIn(start, DHAKA)} Dhaka</span> · {timeIn(start, zone)} {zoneLabelIn(zone, start)} for the student · {s.minutes} min
                  {s.kind === "makeup" ? " · make-up class" : ""}
                </p>
                <div className="mt-3">
                  {s.state === "ended" && s.status ? (
                    <AttendanceStatusBadge status={s.status} />
                  ) : s.state === "in_progress" ? (
                    <span className="inline-flex min-h-7 items-center rounded-chip bg-success-tint px-2.5 text-ui font-medium text-success">In progress</span>
                  ) : (
                    <span className="text-ui text-ink-muted">Starts {untilText(now, start)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
