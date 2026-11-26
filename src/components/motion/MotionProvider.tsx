"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ScrollDirectionProvider } from "./scroll-direction";

/** Loaded after hydration: the animation features (domAnimation) never block the first paint. Layout features load only where used (LayoutFeatures). */
const loadFeatures = () => import("./features").then((mod) => mod.default);

/**
 * The Motion boundary (owner, 22 Nov 2026). Each page that uses Reveal,
 * AnimatedList or SlidingFilter wraps its whole content in it (Home, /courses,
 * /courses/[slug], /instructors, /instructors/[slug], /programs/[slug],
 * /scholarship). It is not in the root layout: LazyMotion carries Motion's
 * VisualElement and value engine (about 11 KB gz), which pages without
 * motion (/contact, /enroll, the 404 page) should not load (js-budget,
 * 26 Nov 2026). A Reveal outside it throws (useScrollDirection), so a missed
 * page fails loudly instead of silently losing its motion.
 *   - LazyMotion strict: only the light `m` components; the features load
 *     lazily, so the server HTML paints before any of Motion's code runs.
 *   - reducedMotion "user": under prefers-reduced-motion every transform and
 *     layout move is skipped and only opacity changes.
 *   - ScrollDirectionProvider: the one scroll-direction listener that every
 *     reveal shares.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <ScrollDirectionProvider>{children}</ScrollDirectionProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
