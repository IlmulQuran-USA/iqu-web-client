"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** The list glide (a ~380 ms spring) plus a little slack, so nothing settles before the movers land. */
export const HOLD_MS = 450;

/**
 * Keeps a block at its previous height for a moment when its content shrinks
 * (a filter change), so the content after it never jumps up underneath items
 * that are still gliding. `signature` names the content: a new value means it
 * changed. Skipped under reduced motion, where nothing glides.
 */
export function HoldHeight({
  signature,
  children,
  className,
}: {
  signature: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);
  const [hold, setHold] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    const previous = lastHeight.current;
    lastHeight.current = height;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || previous === 0 || height >= previous) return;
    setHold(previous);
    const timer = window.setTimeout(() => setHold(null), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [signature]);

  return (
    <div ref={ref} className={className} style={hold ? { minHeight: hold } : undefined}>
      {children}
    </div>
  );
}
