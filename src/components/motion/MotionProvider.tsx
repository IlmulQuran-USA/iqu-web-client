"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Loaded after hydration: the animation, layout and gesture features never block the first paint. */
const loadFeatures = () => import("./features").then((mod) => mod.default);

/**
 * The one Motion boundary, around the whole site (root layout; owner,
 * 22 Nov 2026).
 *   - LazyMotion strict: only the light `m` components; the features load
 *     lazily, so the server HTML paints before any of Motion's code runs.
 *   - reducedMotion "user": under prefers-reduced-motion every transform and
 *     layout move is skipped and only opacity changes.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
