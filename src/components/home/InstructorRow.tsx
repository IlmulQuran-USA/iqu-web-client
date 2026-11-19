"use client";

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";

/**
 * The featured-instructor row in the Home hero (owner decision, 19 Nov 2026).
 * Always one row, in the given order.
 *
 *   < 640 px  a swipe row: cards are 40vw wide (about 2½ in view), snap to
 *             each card, and the row bleeds to the screen edges. No
 *             autoplay, no arrows. A thin indicator under the row shows the
 *             scroll position; it is drawn here because iOS hides native
 *             horizontal scrollbars until the user scrolls. Cards are links
 *             in order, so Tab scrolls each into view natively.
 *   ≥ 640 px  all cards in one row of equal columns, never wrapping; gap
 *             12 px, 24 px from 1024.
 *
 * Each card spans three subgrid rows (portrait, name, role), so names and
 * roles line up across the row. The focus ring is never clipped: the
 * scroller has 4 px of vertical padding and the bleed padding sideways.
 *
 * Exception to CLAUDE.md §4 "no carousels for primary content": the owner
 * asked for this swipe row on phones. It is manual only, with every item
 * reachable by keyboard.
 */
export function InstructorRow({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [thumb, setThumb] = useState<{ size: number; offset: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const { scrollWidth, clientWidth, scrollLeft } = el;
      setThumb(scrollWidth > clientWidth + 1 ? { size: clientWidth / scrollWidth, offset: scrollLeft / scrollWidth } : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    el.addEventListener("scroll", schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // With mandatory snapping, the browser's own scroll-into-view on focus can
  // be pulled back to the previous snap point, leaving the focused card half
  // hidden. When a card is not fully in view, align it to its own snap point.
  const onFocus = (event: FocusEvent<HTMLUListElement>) => {
    const el = ref.current;
    const card = (event.target as HTMLElement).closest("li");
    if (!el || !card || el.scrollWidth <= el.clientWidth + 1) return;
    const row = el.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    if (box.left < row.left || box.right > row.right) card.scrollIntoView({ block: "nearest", inline: "start" });
  };

  return (
    <>
      <ul
        ref={ref}
        onFocus={onFocus}
        style={{ "--cols": count } as CSSProperties}
        className={
          // Phones: swipe row, full bleed, snap, native scrollbar hidden (the indicator replaces it).
          "-mx-4 grid auto-cols-[40vw] grid-flow-col grid-rows-[repeat(3,auto)] gap-x-3 overflow-x-auto overscroll-x-contain px-4 py-1 " +
          "snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden " +
          // ≥ 640: one row of equal columns, no scrolling.
          "min-[40rem]:mx-0 min-[40rem]:snap-none min-[40rem]:grid-flow-row min-[40rem]:grid-cols-[repeat(var(--cols),minmax(0,1fr))] " +
          "min-[40rem]:overflow-visible min-[40rem]:px-0 lg:gap-x-6"
        }
      >
        {children}
      </ul>
      {/* Thin scroll indicator, phones only. It keeps its space before
          hydration (invisible), so nothing shifts when it appears. */}
      <div
        aria-hidden="true"
        className={`mx-auto mt-3 h-0.75 w-24 overflow-hidden rounded-pill bg-rule min-[40rem]:hidden ${thumb ? "" : "invisible"}`}
      >
        <div
          className="h-full rounded-pill bg-ink-muted"
          style={thumb ? { width: `${thumb.size * 100}%`, transform: `translateX(${(thumb.offset / thumb.size) * 100}%)` } : undefined}
        />
      </div>
    </>
  );
}
