"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The course page sub-navigation (spec §7.3 section 2; spec §6.3 TabBar).
 * Anchored links to sections that are all in the DOM, never click-tabs. It
 * sticks under the header and highlights the section being read. On phones it
 * scrolls sideways, keeps the current link in view, and shows a solid end cap
 * with a chevron while more links are off to the right (no fade: DESIGN.md
 * allows no gradients).
 *
 * It lists only the sections the course has (src/content/course-page.ts).
 * Without JavaScript it is a plain list of anchors.
 */

/** Slack below the bar: a section is current once its top is within this of the bar's bottom edge. */
const SPY_SLACK = 40;

export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [moreRight, setMoreRight] = useState(false);
  // The one indicator bar under the current link: x and width in px, moved by transform only.
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  // The first placement is instant (no slide in from the left edge); later moves glide.
  const [glide, setGlide] = useState(false);

  useEffect(() => {
    const targets = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // A section is current once its top passes under the header and this bar.
      const line = (listRef.current?.getBoundingClientRect().bottom ?? 0) + SPY_SLACK;
      let current: string | null = null;
      for (const el of targets) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // A jump by link or by URL marks its target at once, before any scroll settles.
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (sections.some((s) => s.id === id)) setActive(id);
    };
    update();
    onHash();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scrollend", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("scrollend", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", onHash);
      cancelAnimationFrame(frame);
    };
  }, [sections]);

  // Phones: whether more links sit off to the right.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setMoreRight(list.scrollLeft + list.clientWidth < list.scrollWidth - 2);
    measure();
    list.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    return () => {
      list.removeEventListener("scroll", measure);
      resize.disconnect();
    };
  }, []);

  // Place the indicator under the current link (the 12 px side padding of each link excluded).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const place = () => {
      const link = active ? list.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
      // No current section: keep the last position and fade out, rather than slide to x = 0.
      if (!link) return;
      setBar({ x: link.offsetLeft - list.offsetLeft + 12, w: link.offsetWidth - 24 });
      frame = requestAnimationFrame(() => setGlide(true));
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(list);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [active]);

  // Keep the current link in view in the sideways-scrolling bar.
  useEffect(() => {
    const list = listRef.current;
    const link = active ? list?.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    const left = link.offsetLeft - list.offsetLeft;
    // Leave room for the end cap on the right.
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth - 40) {
      list.scrollTo({ left: Math.max(0, left - 16) });
    }
  }, [active]);

  return (
    <nav
      aria-label="On this page"
      data-sticky-subnav=""
      className="sticky top-(--header-height) z-30 -mx-4 border-b border-rule bg-paper sm:-mx-6 lg:mx-0"
    >
      <ul
        ref={listRef}
        className="relative flex overflow-x-auto px-1 [scrollbar-width:none] sm:px-3 lg:-mx-3 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              onClick={() => setActive(section.id)}
              aria-current={active === section.id ? "location" : undefined}
              className={cn(
                "relative inline-flex min-h-12 items-center rounded-chip px-3 text-ui font-medium whitespace-nowrap",
                "transition-colors duration-(--duration-micro) ease-riwaq motion-reduce:transition-none",
                active === section.id ? "text-ink" : "text-ink-muted hov:text-ink",
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
        {/* The indicator glides from link to link (200 ms, transform only); it jumps under reduced motion. */}
        <li
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-accent-strong",
            glide
              ? "transition-[transform,opacity] duration-(--duration-default) ease-riwaq motion-reduce:transition-none"
              : "transition-opacity duration-(--duration-micro) motion-reduce:transition-none",
            bar && active ? "opacity-100" : "opacity-0",
          )}
          style={bar ? { transform: `translateX(${bar.x}px) scaleX(${bar.w})` } : undefined}
        />
        {/* Keeps the last link clear of the end cap when scrolled to the end. */}
        <li aria-hidden="true" className="w-8 shrink-0 lg:hidden" />
      </ul>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center border-l border-rule bg-paper text-ink-muted lg:hidden",
          moreRight ? "" : "hidden",
        )}
      >
        <ChevronRight strokeWidth={1.5} className="size-4" />
      </div>
    </nav>
  );
}
