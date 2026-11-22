"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadMax = () => import("./features-max").then((mod) => mod.default);

/**
 * Loads Motion's layout features (domMax) for the components inside it, after
 * hydration. Every other page gets only domAnimation from MotionProvider
 * (owner, 23 Nov 2026): used by AnimatedList and SlidingFilter, the filter
 * glides on /courses and /instructors.
 */
export function LayoutFeatures({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadMax}>{children}</LazyMotion>;
}
