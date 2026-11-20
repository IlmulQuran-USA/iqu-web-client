import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

/**
 * Breadcrumb (spec §6.3): the trail to the current page. Every link is a
 * 44 px target (CLAUDE.md §4); the current page is plain text marked
 * aria-current. Separators are decorative.
 */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center text-ui text-ink-muted">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {/* The separator sits inside the item, so a wrap never leaves a chevron at a line end. */}
            <li className="flex min-h-11 items-center">
              {i > 0 ? <ChevronRight aria-hidden="true" strokeWidth={1.5} className="mx-1 size-4 shrink-0" /> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 min-w-11 items-center rounded-chip decoration-1 underline-offset-2 hov:text-ink hov:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink-body">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
