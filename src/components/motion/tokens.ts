import type { Transition } from "motion/react";

/*
 * Motion tokens (DESIGN.md §6; owner, 22 Nov 2026). Springs for everything
 * that enters or moves; the DESIGN.md easing for fades and exits. Under
 * prefers-reduced-motion, MotionConfig reducedMotion="user" (MotionProvider)
 * drops every transform and keeps the opacity only.
 */

/** cubic-bezier(0.2, 0, 0, 1), DESIGN.md §6. */
export const EASE = [0.2, 0, 0, 1] as const;

/** Scroll reveals and the hero: a smooth spring with a light settle. */
export const SPRING = { type: "spring", visualDuration: 0.7, bounce: 0.18 } as const satisfies Transition;

/** Menus, the drawer, the FAQ and filter glides: quicker, a little firmer. */
export const SPRING_SNAPPY = { type: "spring", visualDuration: 0.38, bounce: 0.14 } as const satisfies Transition;

/** Fades run on a tween, so opacity never overshoots. */
export const FADE = { duration: 0.5, ease: EASE } as const satisfies Transition;

/** How far a section rises as it scrolls into view, in px. */
export const RISE = 30;

/** Delay between items inside a section, in seconds. */
export const STAGGER = 0.08;
