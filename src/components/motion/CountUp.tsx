"use client";

import { useEffect, useRef } from "react";
import { EASE } from "./tokens";

/**
 * A line with numbers in it ("5 Muftis") whose numbers count up from 0 when
 * it scrolls into view, once (owner, 22 Nov 2026). The server HTML holds the
 * real figures, and they are only reset to 0 after hydration when the line
 * starts below the fold (off screen, so the change is never seen). Each
 * number keeps the width of its final value (tabular figures, right-aligned),
 * so nothing around it moves. Screen readers get the final text only.
 * Under reduced motion the numbers never count.
 */
export function CountUp({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const parts = text.split(/(\d+)/);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const numbers = Array.from(el.querySelectorAll<HTMLElement>("[data-count]"));
    numbers.forEach((n) => (n.textContent = "0"));
    const stops: Array<() => void> = [];
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        import("./count-animate").then(({ animate }) => {
          if (cancelled) return;
          for (const n of numbers) {
            const target = Number(n.dataset.count);
            const controls = animate(0, target, {
              duration: 1.4,
              delay: 0.25,
              ease: EASE,
              onUpdate: (v) => (n.textContent = String(Math.round(v))),
            });
            stops.push(() => controls.stop());
          }
        });
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      stops.forEach((stop) => stop());
      numbers.forEach((n) => (n.textContent = n.dataset.count ?? ""));
    };
  }, []);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">
        {parts.map((part, i) =>
          /^\d+$/.test(part) ? (
            <span
              key={i}
              data-count={part}
              className="inline-block text-right tabular-nums"
              style={{ minWidth: `${part.length}ch` }}
            >
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
