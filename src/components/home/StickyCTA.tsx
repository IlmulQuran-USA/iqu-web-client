"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * StickyCTA (spec §6.3, §7.1 "Mobile"): a bottom bar with the primary
 * enrolment action below lg, where the header has no CTA.
 *
 * It appears only once the hero's CTAs have scrolled away, and hides again
 * when the final CTA band is reached, so exactly one filled button is in view
 * at any time (CLAUDE.md §4). While hidden it is inert, so it leaves the tab
 * order. It slides; with reduced motion it simply appears.
 */
export function StickyCTA({
  label,
  href,
  afterId,
  beforeId,
}: {
  label: string;
  href: string;
  /** Element whose passing reveals the bar (the hero CTAs). */
  afterId: string;
  /** Element whose arrival hides the bar (the final CTA band). */
  beforeId: string;
}) {
  const [heroPassed, setHeroPassed] = useState(false);
  const [finalReached, setFinalReached] = useState(false);

  useEffect(() => {
    const after = document.getElementById(afterId);
    const before = document.getElementById(beforeId);
    if (!after || !before) return;
    const heroObserver = new IntersectionObserver(([entry]) =>
      setHeroPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    const finalObserver = new IntersectionObserver(([entry]) =>
      setFinalReached(entry.isIntersecting || entry.boundingClientRect.top < 0),
    );
    heroObserver.observe(after);
    finalObserver.observe(before);
    return () => {
      heroObserver.disconnect();
      finalObserver.disconnect();
    };
  }, [afterId, beforeId]);

  const shown = heroPassed && !finalReached;

  return (
    <div
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden",
        "transition-transform duration-(--duration-default) ease-riwaq motion-reduce:transition-none",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      <ButtonLink href={href} fullWidth>
        {label}
      </ButtonLink>
    </div>
  );
}
