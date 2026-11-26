"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
// Named imports, not `import * as m`: see Reveal.tsx (keeps Reorder out of the bundle).
import { div as MotionDiv, li as MotionLi, ul as MotionUl } from "motion/react-m";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HOLD_MS } from "./HoldHeight";
import { LayoutFeatures } from "./LayoutFeatures";
import { EASE, SPRING_SNAPPY } from "./tokens";

export type AnimatedItem = { key: string; node: ReactNode; className?: string };

/**
 * A list that a filter changes (the /courses groups, the /instructors cards).
 * When the URL's filter changes, items that leave fade out (120 ms); items
 * that stay glide to their new places on a spring (layout animation, owner
 * 22 Nov 2026); new ones fade and rise in once the leavers are gone, so two
 * cards never overlap. Nothing animates on the first render. The items are
 * server-rendered nodes passed in; this leaf only moves them.
 *
 * While a shrinking list glides, it keeps its previous height, so the content
 * after it never jumps up underneath items that are still moving; it settles
 * once the glide ends. Under reduced motion nothing moves and the height is
 * not held.
 */
export function AnimatedList({
  items,
  as = "ul",
  itemAs = "li",
  className,
}: {
  items: AnimatedItem[];
  as?: "ul" | "div";
  itemAs?: "li" | "div";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const lastHeight = useRef(0);
  const [hold, setHold] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const signature = items.map((i) => i.key).join("|");

  // After each change of items: if the list got shorter, hold the old height for the glide.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    const previous = lastHeight.current;
    lastHeight.current = height;
    if (reduced || previous === 0 || height >= previous) return;
    setHold(previous);
    const timer = window.setTimeout(() => setHold(null), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [signature, reduced]);

  const ListTag = as === "ul" ? MotionUl : MotionDiv;
  const Item = itemAs === "li" ? MotionLi : MotionDiv;
  return (
    // The glide needs Motion's layout features, loaded here only (LayoutFeatures).
    <LayoutFeatures>
      <ListTag ref={ref as never} className={className} style={{ position: "relative", minHeight: hold ?? undefined }}>
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <Item
              key={item.key}
              layout="position"
              className={item.className}
              initial={{ opacity: 0, y: 16 }}
              // Arrivals wait for the leavers' 120 ms fade, so nothing stacks.
              animate={{
                opacity: 1,
                y: 0,
                transition: { opacity: { duration: 0.24, delay: 0.12, ease: EASE }, y: { ...SPRING_SNAPPY, delay: 0.12 } },
              }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE } }}
              transition={{ layout: SPRING_SNAPPY }}
            >
              {item.node}
            </Item>
          ))}
        </AnimatePresence>
      </ListTag>
    </LayoutFeatures>
  );
}
