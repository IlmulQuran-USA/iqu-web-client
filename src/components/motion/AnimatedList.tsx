"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HOLD_MS } from "./HoldHeight";
import { EASE, MotionLeaf } from "./MotionLeaf";

export type AnimatedItem = { key: string; node: ReactNode; className?: string };

/** The glide, DESIGN.md §6 panel duration. */
const GLIDE_MS = 320;

/**
 * A list that a filter changes (the /courses groups, the /instructors cards).
 * When the URL's filter changes, items that leave fade out (120 ms); items
 * that stay glide to their new places (layout, 320 ms); new ones fade in
 * (200 ms) only once the leavers are gone, so two cards never overlap.
 * Nothing animates on the first render. The items are server-rendered nodes
 * passed in; this leaf only moves them.
 *
 * `glide={false}`: no layout move; staying items take their new places at once
 * while the leavers fade out and the arrivals fade in (the /instructors grid,
 * where a glide crossed the next group's heading).
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
  glide = true,
  className,
}: {
  items: AnimatedItem[];
  as?: "ul" | "div";
  itemAs?: "li" | "div";
  glide?: boolean;
  className?: string;
}) {
  return (
    <MotionLeaf>
      <List items={items} as={as} itemAs={itemAs} glide={glide} className={className} />
    </MotionLeaf>
  );
}

function List({
  items,
  as,
  itemAs,
  glide,
  className,
}: {
  items: AnimatedItem[];
  as: "ul" | "div";
  itemAs: "li" | "div";
  glide: boolean;
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

  const ListTag = as === "ul" ? m.ul : m.div;
  const Item = itemAs === "li" ? m.li : m.div;
  return (
    <ListTag ref={ref as never} className={className} style={{ position: "relative", minHeight: hold ?? undefined }}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => (
          <Item
            key={item.key}
            layout={glide ? "position" : false}
            className={item.className}
            initial={{ opacity: 0 }}
            // Arrivals wait for the leavers' 120 ms fade, so nothing stacks.
            animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.12, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE } }}
            transition={{ layout: { duration: GLIDE_MS / 1000, ease: EASE } }}
          >
            {item.node}
          </Item>
        ))}
      </AnimatePresence>
    </ListTag>
  );
}
