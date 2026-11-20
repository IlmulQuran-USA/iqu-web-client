"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const WIDE = "(min-width: 48rem)";

/**
 * A curriculum row that folds on phones only (spec §7.3 section 4 "module
 * accordion"; owner, 20 Nov 2026). A native <details>, so the content is
 * always in the DOM and crawlable.
 *
 *   ≥ 768 px  always open; the summary is a plain heading row (no chevron,
 *             not focusable, a click does nothing).
 *   < 768 px  only the row marked openOnPhone starts open; the rest fold,
 *             and the chevron turns with the state.
 *
 * The server renders every row open, so without JavaScript nothing is hidden.
 */
export function PhoneDisclosure({
  summary,
  children,
  openOnPhone = false,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  openOnPhone?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const apply = () => {
      setWide(query.matches);
      if (ref.current) ref.current.open = query.matches || openOnPhone;
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [openOnPhone]);

  return (
    <details ref={ref} open className={cn("group/fold", className)}>
      <summary
        tabIndex={wide ? -1 : undefined}
        onClick={(event) => {
          if (wide) event.preventDefault();
        }}
        className="flex cursor-pointer list-none items-start gap-3 rounded-chip md:cursor-default [&::-webkit-details-marker]:hidden"
      >
        <span className="block min-w-0 flex-1">{summary}</span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className="mt-1 size-5 shrink-0 text-ink-muted transition-transform duration-(--duration-default) ease-riwaq group-open/fold:rotate-180 motion-reduce:transition-none md:hidden"
        />
      </summary>
      {children}
    </details>
  );
}
