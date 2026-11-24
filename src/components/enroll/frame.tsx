import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { site } from "@/content/site";

/*
 * The enrollment frame (spec §7.17 "Persistent frame"): a slim header with the
 * logo and the progress text, and a quiet footer with the organisation line
 * and how to reach us. No site navigation and no Donate here: enrollment and
 * giving stay apart (PRODUCT.md).
 */

export function EnrollHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="container-content flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Logo />
        {children ? <div className="flex items-center gap-3 text-ui text-ink-muted">{children}</div> : null}
      </div>
    </header>
  );
}

export function EnrollFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="container-content flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 text-ui text-ink-muted">
        <p>
          © {site.name} · {site.taxStatus} · EIN {site.ein}
        </p>
        <p className="flex flex-wrap gap-x-4">
          {site.phone ? (
            <a href={site.phone.href} className="inline-flex min-h-11 items-center hov:text-ink">
              {site.phone.display}
            </a>
          ) : null}
          {site.email ? (
            <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center hov:text-ink">
              {site.email}
            </a>
          ) : null}
        </p>
      </div>
    </footer>
  );
}
