import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

/*
 * The portal's inline alert (spec §6.3 InlineAlert; never a toast). The same
 * look as the enrollment form's, kept separate on purpose: sharing that
 * module made the bundler regroup /enroll's chunks (portal Batch 1 budget
 * check). Soft badge colours only (DESIGN.md §2 Status).
 */
const TONES = {
  info: { box: "bg-info-tint", icon: Info, color: "text-info" },
  success: { box: "bg-success-tint", icon: CircleCheck, color: "text-success" },
  danger: { box: "bg-danger-tint", icon: CircleAlert, color: "text-danger" },
} as const;

export function Alert({ tone = "info", title, children }: { tone?: keyof typeof TONES; title: ReactNode; children?: ReactNode }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div className={`flex gap-3 rounded-card p-4 ${t.box}`}>
      <Icon aria-hidden="true" strokeWidth={1.5} className={`mt-0.5 size-5 shrink-0 ${t.color}`} />
      <div className="min-w-0 text-ui">
        <p className="font-medium text-ink">{title}</p>
        {children ? <div className="mt-1 text-ink-body">{children}</div> : null}
      </div>
    </div>
  );
}
