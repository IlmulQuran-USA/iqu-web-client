"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ScrollDirection = "down" | "up";

/** The current scroll direction, read on demand (never a re-render). */
export type ScrollDirectionValue = { get(): ScrollDirection };

const DirectionContext = createContext<ScrollDirectionValue | null>(null);

/**
 * The page's scroll direction, detected once for the whole site (owner,
 * 22 Nov 2026) and shared as a value object, so reading it never re-renders
 * anything. Reveals read it at the moment they enter or leave the viewport.
 * Starts as "down": a fresh page is read from the top.
 *
 * A plain passive scroll listener, not Motion's useScroll/useMotionValue:
 * those put Motion's scroll tracking and value engine into the first load of
 * every page, 404 included, for one comparison (about 12 KB gz; js-budget
 * diagnosis, 26 Nov 2026). The behaviour is the same.
 */
export function ScrollDirectionProvider({ children }: { children: ReactNode }) {
  const [state] = useState(() => {
    let current: ScrollDirection = "down";
    return {
      value: { get: () => current } satisfies ScrollDirectionValue,
      set: (next: ScrollDirection) => {
        current = next;
      },
    };
  });

  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => {
      const latest = window.scrollY;
      if (latest > previous) state.set("down");
      else if (latest < previous) state.set("up");
      previous = latest;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [state]);

  return <DirectionContext.Provider value={state.value}>{children}</DirectionContext.Provider>;
}

/** The shared scroll direction (read it with .get()). */
export function useScrollDirection(): ScrollDirectionValue {
  const direction = useContext(DirectionContext);
  if (!direction) throw new Error("useScrollDirection needs ScrollDirectionProvider (MotionProvider)");
  return direction;
}
