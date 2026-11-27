import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { site } from "@/content/site";
import { archGeometry, archMask, archRatios } from "@/lib/arch";

/**
 * The sign-in pages' layout (spec §7D.2; DESIGN.md §1 "auth-page photo" in
 * the riwāq arch). Form on --paper on the left; on the right, from lg, the
 * tall arch. There is no photograph of a real class yet and no student quote
 * given with consent (spec §8), so the arch holds the organisation's own
 * live mission line instead, never stock imagery or an invented quote.
 * Phones: the form only.
 */
export function AuthLayout({ children, tag }: { children: ReactNode; tag?: ReactNode }) {
  const ratio = archRatios.tall;
  const g = archGeometry(ratio);
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          {tag}
        </div>
        <main id="main-content" className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto w-full max-w-drawer">{children}</div>
        </main>
      </div>

      <div aria-hidden="true" className="hidden items-center justify-center bg-surface-2 p-12 lg:flex">
        <div className="relative w-full max-w-drawer" style={{ aspectRatio: g.aspectRatio }}>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-surface px-[14%] pt-[22%] text-center"
            style={{ maskImage: archMask(ratio), WebkitMaskImage: archMask(ratio), maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
          >
            <p className="eyebrow">{site.missionLine.label.replace(/:$/, "")}</p>
            <p className="mt-4 font-display text-heading-lg font-medium text-balance text-ink">
              {site.missionLine.text.charAt(0).toUpperCase() + site.missionLine.text.slice(1)}
            </p>
          </div>
          <svg viewBox={g.viewBox} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <path d={g.edge} fill="none" stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** The dev-only label (owner answer 2), also on the sign-in pages. */
export function PreviewLabel() {
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center rounded-chip bg-info-tint px-2.5 text-ui-xs font-medium text-info">
      Preview · sample data
    </span>
  );
}
