"use client";

import type { Variants } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState, type ComponentProps, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { FADE, RISE, SPRING, STAGGER } from "./tokens";

/*
 * Scroll reveal (owner, 22 Nov 2026): a section fades in and rises 30 px on a
 * spring as it scrolls into view, once. The RevealItems inside it (cards,
 * rows, steps, questions, testimonials, instructor cards) follow one after
 * another, 80 ms apart. Transform and opacity only.
 *
 * Nothing above the fold ever waits: the server HTML is fully visible, and
 * after hydration only a section whose top is still below the viewport is
 * hidden (off screen, so the change is never seen). It plays when its top
 * passes 85% of the viewport height, or at once when anything inside it takes
 * keyboard focus. No JavaScript, an old browser or print: the content simply
 * stays visible (print CSS overrides the inline styles).
 */

type Tag = "div" | "section" | "ul" | "ol" | "li" | "details";

const section: Variants = {
  hidden: { opacity: 0, y: RISE, transition: { duration: 0 } },
  shown: {
    opacity: 1,
    y: 0,
    transition: { y: SPRING, opacity: FADE, delayChildren: 0.1, staggerChildren: STAGGER },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: RISE, transition: { duration: 0 } },
  shown: { opacity: 1, y: 0, transition: { y: SPRING, opacity: FADE } },
};

type RevealProps<T extends Tag> = Omit<ComponentProps<T>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> & {
  as?: T;
  children: ReactNode;
};

export function Reveal<T extends Tag = "div">({ as, children, ...rest }: RevealProps<T>) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Already in (or above) the first view: leave it exactly as rendered.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("hidden");
    const show = () => {
      setState("shown");
      observer.disconnect();
      el.removeEventListener("focusin", show);
    };
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && show(), {
      rootMargin: "0px 0px -15% 0px",
    });
    observer.observe(el);
    // Keyboard focus never lands on something invisible: focusing inside reveals it at once.
    el.addEventListener("focusin", show);
    return () => {
      observer.disconnect();
      el.removeEventListener("focusin", show);
    };
  }, []);

  const Component = m[(as ?? "div") as Tag] as unknown as typeof m.div;
  return (
    <Component
      {...(rest as ComponentPropsWithoutRef<typeof m.div>)}
      ref={ref as never}
      initial={false}
      animate={state === "hidden" ? "hidden" : "shown"}
      variants={section}
      data-reveal={state === "idle" ? undefined : state}
    >
      {children}
    </Component>
  );
}

/**
 * One item inside a Reveal: it follows the section in turn. Outside a Reveal
 * it renders as a plain element (no variants are ever triggered).
 */
export function RevealItem<T extends Tag = "div">({ as, children, ...rest }: RevealProps<T>) {
  const Component = m[(as ?? "div") as Tag] as unknown as typeof m.div;
  return (
    <Component {...(rest as ComponentPropsWithoutRef<typeof m.div>)} variants={item} data-reveal-item="">
      {children}
    </Component>
  );
}
