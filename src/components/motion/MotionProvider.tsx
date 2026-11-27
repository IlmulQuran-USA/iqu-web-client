"use client";

import { useEffect, type ReactNode } from "react";
import { preloadKit } from "./kit";
import { ScrollDirectionProvider } from "./scroll-direction";

/**
 * The motion boundary (owner, 22 Nov 2026). Each page that uses Reveal,
 * AnimatedList or SlidingFilter wraps its whole content in it (Home, /courses,
 * /courses/[slug], /instructors, /instructors/[slug], /programs/[slug],
 * /scholarship). A Reveal outside it throws (useScrollDirection), so a missed
 * page fails loudly instead of silently losing its motion.
 *   - ScrollDirectionProvider: the one scroll-direction listener that every
 *     reveal shares.
 *   - The animation kit (./kit.ts: Motion's mini animate and spring) starts
 *     loading when the browser is idle after the first paint, so no page
 *     waits on it and it is there before the first scroll or filter tap
 *     (js-headroom, 27 Nov 2026; it replaced LazyMotion, whose engine sat in
 *     every motion page's first load).
 *   - Reduced motion is honoured where each animation is played
 *     (prefersReducedMotion): transforms are dropped, opacity still changes.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => preloadKit(), []);
  return <ScrollDirectionProvider>{children}</ScrollDirectionProvider>;
}
