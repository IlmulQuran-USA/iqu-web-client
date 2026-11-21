"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Loaded after hydration: the layout/exit features never block the first paint. */
const loadFeatures = () => import("./features").then((mod) => mod.default);

/**
 * The only way Motion enters the site (owner plan approved 22 Nov 2026):
 * small client leaves on /courses and /instructors, inside this boundary.
 *   - LazyMotion strict: only the light `m` components; features load lazily.
 *   - reducedMotion "user": under prefers-reduced-motion, transforms and layout
 *     moves are skipped and only opacity changes.
 *   - DESIGN.md §6 easing; durations are set per animation (120/200/320 ms).
 */
export function MotionLeaf({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ ease: EASE, duration: 0.32 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

/** cubic-bezier(0.2, 0, 0, 1), DESIGN.md §6. */
export const EASE = [0.2, 0, 0, 1] as const;
