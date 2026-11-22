"use client";

import type { Variants } from "motion/react";
import * as m from "motion/react-m";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { RevealItem } from "@/components/motion/Reveal";
import { EASE, SPRING_SNAPPY } from "@/components/motion/tokens";

/*
 * The answer opens on a spring and closes with a quick ease (owner, 22 Nov
 * 2026). The answer's height is the one property here that is not a
 * transform or opacity: it is what moves the questions below, smoothly
 * instead of in one jump (approved for the FAQ, 22 Nov 2026).
 *
 * Still a native <details>: without JavaScript it opens and closes at once,
 * and the browser's find-in-page can open it (onToggle then springs the
 * answer open). The answer carries no inline height until it is first used
 * ("rest"), so the server HTML never hides it.
 *
 *   rest       as rendered by the server; nothing set
 *   collapsed  height 0 at once, the frame before "open", so it opens from 0
 *   open       springs to its natural height
 *   closed     eases to 0 from its measured height, then details closes
 */
type Phase = "rest" | "collapsed" | "open" | "closed";

const answer: Variants = {
  rest: {},
  collapsed: { height: 0, opacity: 0, transition: { duration: 0 } },
  open: {
    height: "auto",
    opacity: 1,
    transition: { height: SPRING_SNAPPY, opacity: { duration: 0.24, delay: 0.04, ease: EASE } },
  },
  // From the height measured at the click (Motion cannot ease down from "auto").
  closed: (from: number) => ({
    height: [from, 0],
    opacity: 0,
    transition: { height: { duration: 0.24, ease: EASE }, opacity: { duration: 0.14, ease: EASE } },
  }),
};

export function FAQDetails({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("rest");
  const [from, setFrom] = useState(0);
  const showing = phase === "open" || phase === "collapsed";

  const open = () => {
    const details = ref.current;
    if (!details) return;
    setPhase("collapsed");
    details.open = true;
    // Next frame: spring open from the zero height just set.
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
  };

  const onSummaryClick = (event: MouseEvent<HTMLElement>) => {
    const details = ref.current;
    if (!details) return;
    event.preventDefault();
    if (details.open && showing) {
      setFrom(answerRef.current?.offsetHeight ?? 0);
      setPhase("closed"); // details closes when the answer's exit ends
    } else open();
  };

  return (
    <RevealItem
      as="details"
      ref={ref}
      className="group border-b border-rule"
      // While the answer closes, details is still open: the chevron turns back at once.
      data-closing={phase === "closed" ? "" : undefined}
      // Opened by the browser itself (find-in-page): spring the answer open.
      onToggle={() => {
        if (ref.current?.open && !showing) setPhase("open");
      }}
    >
      <summary
        onClick={onSummaryClick}
        className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-chip py-4 text-body-lg font-medium text-ink [&::-webkit-details-marker]:hidden"
      >
        {summary}
      </summary>
      <m.div
        ref={answerRef}
        initial={false}
        animate={phase}
        custom={from}
        variants={answer}
        className="overflow-hidden"
        onAnimationComplete={(definition) => {
          if (definition === "closed" && ref.current) ref.current.open = false;
        }}
      >
        {children}
      </m.div>
    </RevealItem>
  );
}
