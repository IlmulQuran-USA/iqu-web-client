import {
  Ban,
  CircleCheck,
  CircleDotDashed,
  CircleMinus,
  UserX,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { AttendanceStatus } from "@/content/sample-parent";
import { cn } from "@/lib/cn";

/**
 * AttendanceStatusBadge (spec §6.3, §7C.2; DESIGN.md §9): exactly six
 * statuses, each a soft badge (tint background + strong text, never a solid
 * fill), with an icon and a text label so colour never carries the meaning
 * alone. The thresholds behind a status live in settings (CLAUDE.md §4); this
 * component only shows the status it is given.
 */
const STATUS: Record<
  AttendanceStatus,
  { label: string; icon: LucideIcon; tone: string }
> = {
  present: {
    label: "Present",
    icon: CircleCheck,
    tone: "bg-success-tint text-success",
  },
  partial: {
    label: "Partial",
    icon: CircleDotDashed,
    tone: "bg-warning-tint text-warning",
  },
  "technical-issue": {
    label: "Technical issue",
    icon: WifiOff,
    tone: "bg-info-tint text-info",
  },
  "student-absent": {
    label: "Student absent",
    icon: CircleMinus,
    tone: "bg-danger-tint text-danger",
  },
  "teacher-no-show": {
    label: "Teacher no-show",
    icon: UserX,
    tone: "bg-danger-tint text-danger",
  },
  "class-not-held": {
    label: "Class not held",
    icon: Ban,
    tone: "bg-surface text-ink-muted",
  },
};

export function AttendanceStatusBadge({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  const { label, icon: Icon, tone } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-ui-sm font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-3.5 shrink-0"
      />
      {label}
    </span>
  );
}

export const attendanceLabel = (status: AttendanceStatus) =>
  STATUS[status].label;
