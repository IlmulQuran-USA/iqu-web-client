/*
 * Motion tokens (DESIGN.md §6; owner, 22 Nov 2026). Springs for everything
 * that enters or moves; the DESIGN.md easing for fades and exits. The springs
 * run on Motion's own spring generator (./kit.ts), so they are the same
 * curves as before. Under prefers-reduced-motion every transform is dropped
 * and only the opacity changes (./kit.ts prefersReducedMotion).
 */

export type SpringToken = { readonly type: "spring"; readonly visualDuration: number; readonly bounce: number };

/** cubic-bezier(0.2, 0, 0, 1), DESIGN.md §6. */
export const EASE = [0.2, 0, 0, 1] as const;

/** Scroll reveals and the hero: a smooth spring with a light settle. */
export const SPRING = { type: "spring", visualDuration: 0.7, bounce: 0.18 } as const satisfies SpringToken;

/** Menus, the drawer, the FAQ and filter glides: quicker, a little firmer. */
export const SPRING_SNAPPY = { type: "spring", visualDuration: 0.38, bounce: 0.14 } as const satisfies SpringToken;

/** Fades run on a tween, so opacity never overshoots. */
export const FADE = { duration: 0.5, ease: EASE } as const;

/** How far a section rises as it scrolls into view, in px. */
export const RISE = 30;

/** Delay between items inside a section, in seconds. */
export const STAGGER = 0.08;
