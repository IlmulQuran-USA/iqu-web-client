"use client";

import { useEffect, useRef, useState, type ElementType, type HTMLAttributes, type ReactNode } from "react";

/**
 * Scroll reveal (DESIGN.md §6; owner plan approved 22 Nov 2026): fade + 12 px
 * rise, once, 60 ms stagger. CSS does the motion (globals.css [data-reveal]);
 * this ~1 KB leaf only decides when.
 *
 * Nothing above the fold ever waits: the server HTML is fully visible, and
 * after hydration only a wrapper whose top is still below the viewport is set
 * to "pending" (off screen, so the change is never seen). It turns "in" when
 * its top passes 85% of the viewport height, or when anything inside it takes
 * keyboard focus, then stops observing. No JavaScript, an old
 * browser or a jump to an anchor: the content simply stays visible.
 *
 *   stagger  the wrapper stays still and its [data-reveal-item] children
 *            animate instead, each delayed by its --reveal-i (capped at 5).
 */
export function Reveal({
  children,
  as: Tag = "div",
  stagger = false,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: ElementType;
  stagger?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "pending" | "in">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Already in (or above) the first view: leave it exactly as rendered.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("pending");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState("in");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    // Keyboard focus never lands on something invisible: focusing inside reveals it at once.
    const onFocus = () => {
      setState("in");
      observer.disconnect();
    };
    el.addEventListener("focusin", onFocus);
    return () => {
      observer.disconnect();
      el.removeEventListener("focusin", onFocus);
    };
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      className={className}
      data-reveal={state === "idle" ? undefined : state}
      data-reveal-stagger={stagger ? "" : undefined}
    >
      {children}
    </Tag>
  );
}
