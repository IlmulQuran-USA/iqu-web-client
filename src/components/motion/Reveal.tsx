"use client";

import { useReducedMotion, type Transition, type Variants } from "motion/react";
// Named imports only, never `import * as m` with a computed key (m[tag]): a
// namespace read by a computed key cannot be tree-shaken, and motion/react-m
// also exports Reorder, which pulls drag, pan and the whole animation engine
// (springs, JS and WAAPI animations) into the first load of every page that
// reveals (about 26 KB gz; js-budget diagnosis, 26 Nov 2026). The engine
// arrives later with the lazy features (MotionProvider).
import {
  details as MotionDetails,
  div as MotionDiv,
  li as MotionLi,
  ol as MotionOl,
  section as MotionSection,
  ul as MotionUl,
} from "motion/react-m";
import { useEffect, useRef, useState, type ComponentProps, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useScrollDirection } from "./scroll-direction";
import { EASE, FADE, RISE, SPRING, STAGGER } from "./tokens";

/*
 * Scroll reveal, reversible and direction-aware (owner, 22 Nov 2026).
 *
 *   Enter   scrolling down, a section rises from below (y 30 → 0); scrolling
 *           up, it drops from above (y −30 → 0). Fade in on a spring.
 *   Leave   when it scrolls out it fades and drifts 16 px the way the page
 *           is moving (up when scrolling down, down when scrolling up), so it
 *           comes back from the side it left by.
 *   Items   the RevealItems inside (cards, rows, steps, questions,
 *           testimonials, instructor cards) follow 80 ms apart, in reading
 *           order scrolling down and in reverse scrolling up; they leave the
 *           same way, quicker.
 *
 * "In view" means at least 20% of the section is visible, or 20% of the
 * viewport is filled by it (so a section taller than five screens still
 * counts). The scroll direction comes from one shared listener
 * (ScrollDirectionProvider), read only at the moment of crossing.
 *
 * Nothing above the fold waits on load: the server HTML is fully visible, and
 * after hydration only a section whose top is still below the viewport is
 * hidden (off screen, so the change is never seen). Keyboard focus inside a
 * section shows it and its items at once, with no fade or stagger. No JavaScript, an old browser or print: the
 * content simply stays visible (print CSS overrides the inline styles).
 * Under reduced motion nothing moves: the same states, opacity only.
 *
 * Transform and opacity only. A section re-enters from its offset only once
 * it has fully faded (invisible, so the jump is never seen); caught while
 * still leaving, it settles back from where it is.
 */

type Tag = "div" | "section" | "ul" | "ol" | "li" | "details";

/** The motion element for each tag a Reveal can render as. */
const elements = {
  div: MotionDiv,
  section: MotionSection,
  ul: MotionUl,
  ol: MotionOl,
  li: MotionLi,
  details: MotionDetails,
} as const;
type MotionDivProps = ComponentPropsWithoutRef<typeof MotionDiv>;

type State =
  | "idle" // as server-rendered, in or above the first view
  | "hiddenBelow" // below the fold on load, waiting
  | "enterFromBelow"
  | "enterFromAbove"
  | "settle" // came back while still leaving
  | "focused" // keyboard focus landed inside: shown at once, no fade or stagger
  | "leaveUp"
  | "leaveDown";

/** How far a leaving section drifts, in px ("slightly"). */
const DRIFT = 16;
const LEAVE = { duration: 0.32, ease: EASE } as const satisfies Transition;
const IN_VIEW = 0.2;

const section: Variants = {
  idle: { opacity: 1, y: 0 },
  hiddenBelow: { opacity: 0, y: RISE, transition: { duration: 0 } },
  enterFromBelow: {
    opacity: [0, 1],
    y: [RISE, 0],
    transition: { y: SPRING, opacity: FADE, delayChildren: 0.1, staggerChildren: STAGGER, staggerDirection: 1 },
  },
  enterFromAbove: {
    opacity: [0, 1],
    y: [-RISE, 0],
    transition: { y: SPRING, opacity: FADE, delayChildren: 0.1, staggerChildren: STAGGER, staggerDirection: -1 },
  },
  settle: { opacity: 1, y: 0, transition: { y: SPRING, opacity: FADE } },
  focused: { opacity: 1, y: 0, transition: { duration: 0 } },
  leaveUp: { opacity: 0, y: -DRIFT, transition: { ...LEAVE, staggerChildren: 0.03, staggerDirection: 1 } },
  leaveDown: { opacity: 0, y: DRIFT, transition: { ...LEAVE, staggerChildren: 0.03, staggerDirection: -1 } },
};

const item: Variants = {
  idle: { opacity: 1, y: 0 },
  hiddenBelow: { opacity: 0, y: RISE, transition: { duration: 0 } },
  enterFromBelow: { opacity: [0, 1], y: [RISE, 0], transition: { y: SPRING, opacity: FADE } },
  enterFromAbove: { opacity: [0, 1], y: [-RISE, 0], transition: { y: SPRING, opacity: FADE } },
  settle: { opacity: 1, y: 0, transition: { y: SPRING, opacity: FADE } },
  focused: { opacity: 1, y: 0, transition: { duration: 0 } },
  leaveUp: { opacity: 0, y: -DRIFT, transition: LEAVE },
  leaveDown: { opacity: 0, y: DRIFT, transition: LEAVE },
};

/**
 * Reduced motion: the same states with y held at 0, so only the fade remains.
 * (MotionConfig would skip the y transitions, but a skipped y still jumps
 * while the section is visible and fading.)
 */
const withoutMovement = (variants: Variants): Variants =>
  Object.fromEntries(
    Object.entries(variants).map(([label, target]) => {
      // y pinned to 0, not removed: the server-rendered style (transform: none) then matches.
      return [label, { ...(target as Record<string, unknown>), y: 0 }];
    }),
  ) as Variants;
const sectionStill = withoutMovement(section);
const itemStill = withoutMovement(item);

const isIn = (s: State) => s === "idle" || s === "settle" || s === "focused" || s === "enterFromBelow" || s === "enterFromAbove";
const isOut = (s: State) => s === "hiddenBelow" || s === "leaveUp" || s === "leaveDown";

type RevealProps<T extends Tag> = Omit<ComponentProps<T>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> & {
  as?: T;
  children: ReactNode;
};

export function Reveal<T extends Tag = "div">({ as, children, ...rest }: RevealProps<T>) {
  const ref = useRef<HTMLElement>(null);
  const direction = useScrollDirection();
  const reduced = useReducedMotion();
  const [state, setState] = useState<State>("idle");
  const stateRef = useRef<State>("idle");
  // True once a leave has fully finished: the section is invisible, so it may re-enter from its offset.
  const gone = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const set = (next: State) => {
      stateRef.current = next;
      setState(next);
    };
    // Below the first view on load: hide it now, off screen.
    if (el.getBoundingClientRect().top >= window.innerHeight) {
      set("hiddenBelow");
      gone.current = true;
    }

    const enter = () => {
      if (isIn(stateRef.current)) return;
      const up = direction.get() === "up";
      set(gone.current ? (up ? "enterFromAbove" : "enterFromBelow") : "settle");
      gone.current = false;
    };
    const leave = () => {
      if (isOut(stateRef.current)) return;
      // Keyboard focus stays visible.
      if (el.contains(document.activeElement) && document.activeElement !== document.body) return;
      set(direction.get() === "up" ? "leaveDown" : "leaveUp");
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting ? entry.intersectionRect.height : 0;
        const need = Math.min(entry.boundingClientRect.height, window.innerHeight) * IN_VIEW;
        if (visible > 0 && visible >= need) enter();
        else leave();
      },
      { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    // Keyboard focus never lands on something invisible: focusing inside shows the
    // section and its items at once (a staggered fade left a focused link
    // transparent for up to half a second; browser QA, 22 Nov 2026).
    const onFocus = () => {
      if (stateRef.current === "idle") return;
      set("focused");
      gone.current = false;
    };
    el.addEventListener("focusin", onFocus);
    return () => {
      observer.disconnect();
      el.removeEventListener("focusin", onFocus);
    };
  }, [direction]);

  const Component = elements[as ?? "div"] as unknown as typeof MotionDiv;
  return (
    <Component
      {...(rest as MotionDivProps)}
      ref={ref as never}
      initial={false}
      animate={state}
      variants={reduced ? sectionStill : section}
      onAnimationComplete={(definition) => {
        if ((definition === "leaveUp" || definition === "leaveDown") && stateRef.current === definition) gone.current = true;
      }}
      data-reveal={state === "idle" ? undefined : state}
    >
      {children}
    </Component>
  );
}

/**
 * One item inside a Reveal: it follows the section in and out, in turn.
 * Outside a Reveal it renders as a plain element (no variants are ever
 * triggered).
 */
export function RevealItem<T extends Tag = "div">({ as, children, ...rest }: RevealProps<T>) {
  const reduced = useReducedMotion();
  const Component = elements[as ?? "div"] as unknown as typeof MotionDiv;
  return (
    <Component {...(rest as MotionDivProps)} variants={reduced ? itemStill : item} data-reveal-item="">
      {children}
    </Component>
  );
}
