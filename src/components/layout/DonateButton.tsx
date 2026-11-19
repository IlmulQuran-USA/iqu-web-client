"use client";

import { HandHeart } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type AnimationEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Donate (owner decision, 19 Nov 2026; DESIGN.md §8). An outlined button,
 * never filled: the filled style belongs to enrolment.
 *
 * 8 px radius, 44 px tall, a HandHeart icon (--accent-strong, 1.5 px) before
 * the label (--link), and a 1 px --accent-strong border. A coral light
 * travels along the border with a soft glow (styles in globals.css):
 *   load   3 laps (4.5 s) when it mounts, inside WCAG 2.2.2's 5 s
 *   rest   static border
 *   lap    one more lap on hover or keyboard focus; the heart also beats
 *          once on hover
 * Under prefers-reduced-motion nothing moves and the border is static.
 * Double border at rest: the 1 px border, a 2 px gap and a 2 px
 * --accent-strong outer ring (globals.css); the light travels along that ring,
 * and on keyboard focus the ring turns --ink.
 * Static states, so hover and press never depend on motion: hover and the
 * current page fill with --tint (--link on it stays above 4.5:1); pressed
 * also darkens the border to --link.
 * The load laps start with the server-rendered HTML, before hydration, so a
 * slow first load can finish them before React listens for animationend. On
 * mount the button therefore checks the running animation and settles when
 * it finishes (or at once if it already has), so it always comes to rest.
 */
export function DonateButton({
  href,
  label,
  current = false,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  current?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [orbit, setOrbit] = useState<"load" | "lap" | "rest">("load");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const settle = () => {
      if (!cancelled) setOrbit((state) => (state === "load" ? "rest" : state));
    };
    const running = el
      .getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSAnimation && a.animationName === "donate-orbit");
    if (running.length === 0) requestAnimationFrame(settle);
    else Promise.all(running.map((a) => a.finished)).then(settle, () => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const lapAgain = () => setOrbit((state) => (state === "rest" ? "lap" : state));
  const onAnimationEnd = (event: AnimationEvent<HTMLAnchorElement>) => {
    if (event.animationName === "donate-orbit") setOrbit("rest");
  };

  return (
    <Link
      ref={ref}
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      data-orbit={orbit}
      onMouseEnter={lapAgain}
      onFocus={lapAgain}
      onAnimationEnd={onAnimationEnd}
      className={cn(
        "donate box-border inline-flex h-11 items-center justify-center gap-2 rounded-button border border-accent-strong px-3 text-body font-medium whitespace-nowrap text-link " +
          "transition-colors duration-(--duration-micro) ease-riwaq hov:bg-tint act:border-link act:bg-tint aria-[current=page]:bg-tint",
        className,
      )}
    >
      <HandHeart aria-hidden="true" strokeWidth={1.5} className="donate-heart size-4 shrink-0 text-accent-strong" />
      {label}
    </Link>
  );
}
