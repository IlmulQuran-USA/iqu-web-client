"use client";

import { useMotionValue, useMotionValueEvent, useScroll, type MotionValue } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

export type ScrollDirection = "down" | "up";

const DirectionContext = createContext<MotionValue<ScrollDirection> | null>(null);

/**
 * The page's scroll direction, detected once for the whole site (owner,
 * 22 Nov 2026) and shared as a motion value, so reading it never re-renders
 * anything. Reveals read it at the moment they enter or leave the viewport.
 * Starts as "down": a fresh page is read from the top.
 */
export function ScrollDirectionProvider({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const direction = useMotionValue<ScrollDirection>("down");
  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? latest;
    if (latest > previous) direction.set("down");
    else if (latest < previous) direction.set("up");
  });
  return <DirectionContext.Provider value={direction}>{children}</DirectionContext.Provider>;
}

/** The shared scroll direction (a motion value; read it with .get()). */
export function useScrollDirection(): MotionValue<ScrollDirection> {
  const direction = useContext(DirectionContext);
  if (!direction) throw new Error("useScrollDirection needs ScrollDirectionProvider (MotionProvider)");
  return direction;
}
