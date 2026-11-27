"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion, readyKit, springOf } from "./kit";
import { Snapshot } from "./Snapshot";
import { SPRING_SNAPPY } from "./tokens";

/** The indicator's box relative to the list, as it looked (mid-slide included). */
type Box = { x: number; y: number; width: number; height: number };

/**
 * A segmented filter whose selected tint slides to the chosen option
 * (on a spring; under reduced motion it simply moves). The options are
 * plain links: state lives in the URL and every option works without
 * JavaScript. Used by the /courses type filter.
 *
 * The tint moves on click, before the server answers, so the choice registers
 * at once; aria-current follows the URL. A new URL (Back, a link) resets it.
 *
 * How it slides (js-headroom, 27 Nov 2026): what Motion's layoutId did, by
 * hand. Just before the tint moves (Snapshot) the old one's box is measured;
 * the new one starts there and springs to its own place and size. Size is
 * animated as width and height rather than scale, so the 1 px border stays
 * 1 px throughout.
 */
export function SlidingFilter({
  id,
  options,
  selected,
  className,
}: {
  /** Unique per page: names the indicator. */
  id: string;
  options: readonly { id: string; label: string; href: string }[];
  selected: string;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [seen, setSeen] = useState(selected);
  if (seen !== selected) {
    setSeen(selected);
    setOptimistic(null);
  }
  const current = optimistic ?? selected;

  const ref = useRef<HTMLUListElement>(null);
  const from = useRef<Box | null>(null);
  const indicator = () => ref.current?.querySelector<HTMLElement>(`[data-indicator="${id}"]`) ?? null;
  const boxOf = (el: HTMLElement): Box => {
    const list = ref.current!.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return { x: rect.left - list.left, y: rect.top - list.top, width: rect.width, height: rect.height };
  };

  const take = () => {
    const el = indicator();
    from.current = el ? boxOf(el) : null;
  };

  useLayoutEffect(() => {
    const previous = from.current;
    from.current = null;
    const el = indicator();
    const kit = readyKit();
    if (!previous || !el || !kit || prefersReducedMotion()) return;
    const to = boxOf(el);
    const dx = previous.x - to.x;
    const dy = previous.y - to.y;
    const options = springOf(kit, SPRING_SNAPPY);
    const slide = kit.animate(
      el,
      {
        transform: [`translate(${dx}px, ${dy}px)`, "none"],
        width: [`${previous.width}px`, `${to.width}px`],
        height: [`${previous.height}px`, `${to.height}px`],
      },
      options,
    );
    // Back to the insets once it lands, so a later resize still fits it.
    const settle = () => {
      el.style.width = "";
      el.style.height = "";
    };
    Promise.resolve(slide).then(settle, settle);
    // Reading `id` and the refs only; the slide follows `current`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <ul ref={ref} className={className}>
      <Snapshot when={current} take={take} />
      {options.map((option) => {
        const isSelected = option.id === selected;
        const isCurrent = option.id === current;
        return (
          <li key={option.id} className="flex">
            <Link
              href={option.href}
              scroll={false}
              onClick={() => setOptimistic(option.id)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "relative inline-flex min-h-11 w-full items-center justify-center rounded-button border px-3 text-center text-ui leading-tight transition-colors duration-(--duration-micro) ease-riwaq sm:px-4",
                isCurrent
                  ? "border-transparent font-medium text-ink"
                  : "border-rule text-ink-body hov:bg-surface-2 hov:text-ink",
              )}
            >
              {isCurrent ? (
                <span
                  data-indicator={id}
                  aria-hidden="true"
                  className="absolute -inset-px rounded-button border border-accent-strong bg-tint"
                />
              ) : null}
              <span className="relative">{option.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
