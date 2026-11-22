"use client";

import * as m from "motion/react-m";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { SPRING_SNAPPY } from "./tokens";

/**
 * A segmented filter whose selected tint slides to the chosen option
 * (layoutId, on a spring; under reduced motion it simply moves). The options are
 * plain links: state lives in the URL and every option works without
 * JavaScript. Used by the /courses type filter.
 *
 * The tint moves on click, before the server answers, so the choice registers
 * at once; aria-current follows the URL. A new URL (Back, a link) resets it.
 */
export function SlidingFilter({
  id,
  options,
  selected,
  className,
}: {
  /** Unique per page: names the shared indicator. */
  id: string;
  options: readonly { id: string; label: string; href: string }[];
  selected: string;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [seen, setSeen] = useState(selected);
  if (seen !== selected) {
    setSeen(selected);
    setOptimistic(null);
  }
  const current = optimistic ?? selected;
  return (
    <ul className={className}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        const isCurrent = option.id === current;
        return (
          <li key={option.id} className="flex">
            <Link
              href={option.href}
              scroll={false}
              onClick={() => setOptimistic(option.id)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "relative inline-flex min-h-11 w-full items-center justify-center rounded-button border px-3 text-center text-ui leading-tight transition-colors duration-(--duration-micro) ease-riwaq sm:px-4",
                isCurrent
                  ? "border-transparent font-medium text-ink"
                  : "border-rule text-ink-body hov:bg-surface-2 hov:text-ink",
              )}
            >
              {isCurrent ? (
                <m.span
                  layoutId={`${id}-indicator`}
                  aria-hidden="true"
                  className="absolute -inset-px rounded-button border border-accent-strong bg-tint"
                  transition={SPRING_SNAPPY}
                />
              ) : null}
              <span className="relative">{option.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
