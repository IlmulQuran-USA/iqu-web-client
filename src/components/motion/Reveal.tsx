"use client";

import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { loadKit, prefersReducedMotion, setNow, springOf, tween, type Kit } from "./kit";
import { useScrollDirection } from "./scroll-direction";
import { FADE, RISE, SPRING, STAGGER } from "./tokens";

/*
 * Scroll reveal, reversible and direction-aware (owner, 22 Nov 2026).
 *
 *   Enter   scrolling down, a section rises from below (y 30 → 0); scrolling
 *           up, it drops from above (y −30 → 0). Fade in on a spring.
 *   Leave   when it scrolls out it fades and drifts 16 px the way the page
 *           is moving (up when scrolling down, down when scrolling up), so it
 *           comes back from the side it left by.
 *   Items   the RevealItems inside (cards, rows, steps, questions,
 *           testimonials, instructor cards) follow 80 ms apart, in reading
 *           order scrolling down and in reverse scrolling up; they leave the
 *           same way, quicker.
 *
 * "In view" means at least 20% of the section is visible, or 20% of the
 * viewport is filled by it (so a section taller than five screens still
 * counts). The scroll direction comes from one shared listener
 * (ScrollDirectionProvider), read only at the moment of crossing.
 *
 * Nothing above the fold waits on load: the server HTML is fully visible, and
 * after hydration only a section whose top is still below the viewport is
 * hidden (off screen, so the change is never seen). Keyboard focus inside a
 * section shows it and its items at once, with no fade or stagger. No JavaScript, an old browser or print: the
 * content simply stays visible (print CSS overrides the inline styles).
 * Under reduced motion nothing moves: the same states, opacity only.
 *
 * Transform and opacity only. A section re-enters from its offset only once
 * it has fully faded (invisible, so the jump is never seen); caught while
 * still leaving, it settles back from where it is.
 *
 * How it runs (js-headroom, 27 Nov 2026): plain elements, and each state is
 * played with Motion's mini animate and Motion's spring generator (./kit.ts),
 * the same timings and curves the Motion variants had. Items are this
 * section's [data-reveal-item] elements in reading order (a nested Reveal
 * keeps its own). The kit arrives after the first paint; the only state that
 * can happen before it, "hidden below the fold", is a plain style write.
 */

type Tag = "div" | "section" | "ul" | "ol" | "li" | "details";

type State =
  | "idle" // as server-rendered, in or above the first view
  | "hiddenBelow" // below the fold on load, waiting
  | "enterFromBelow"
  | "enterFromAbove"
  | "settle" // came back while still leaving
  | "focused" // keyboard focus landed inside: shown at once, no fade or stagger
  | "leaveUp"
  | "leaveDown";

/** How far a leaving section drifts, in px ("slightly"). */
const DRIFT = 16;
/** A leave: 0.32 s on the site's ease; items 30 ms apart. */
const LEAVE = 0.32;
const LEAVE_STAGGER = 0.03;
/** Items start this long after their section on an enter, in seconds. */
const DELAY_CHILDREN = 0.1;
const IN_VIEW = 0.2;

const isIn = (s: State) => s === "idle" || s === "settle" || s === "focused" || s === "enterFromBelow" || s === "enterFromAbove";
const isOut = (s: State) => s === "hiddenBelow" || s === "leaveUp" || s === "leaveDown";

type RevealProps<T extends Tag> = ComponentProps<T> & {
  as?: T;
  children: ReactNode;
};

/** Plays one state on the section and its items; resolves when every animation has ended. */
function play(kit: Kit, el: HTMLElement, items: HTMLElement[], state: State): Promise<unknown> {
  const still = prefersReducedMotion();
  const y = (px: number) => (still ? "none" : `translateY(${px}px)`);
  const ordered = (backwards: boolean) => (backwards ? [...items].reverse() : items);
  const runs: Promise<unknown>[] = [];
  const go = (target: HTMLElement, keyframes: Record<string, (string | number)[] | string | number>, options: object) =>
    runs.push(Promise.resolve(kit.animate(target, keyframes as never, options as never)).catch(() => undefined));

  if (state === "enterFromBelow" || state === "enterFromAbove") {
    const from = state === "enterFromBelow" ? RISE : -RISE;
    const frames = { opacity: [0, 1], transform: [y(from), "none"] };
    go(el, frames, { opacity: tween(FADE.duration), transform: springOf(kit, SPRING) });
    ordered(state === "enterFromAbove").forEach((item, i) => {
      const delay = DELAY_CHILDREN + i * STAGGER;
      go(item, frames, { opacity: tween(FADE.duration, delay), transform: springOf(kit, SPRING, delay) });
    });
  } else if (state === "settle") {
    for (const target of [el, ...items]) go(target, { opacity: 1, transform: "none" }, { opacity: tween(FADE.duration), transform: springOf(kit, SPRING) });
  } else if (state === "leaveUp" || state === "leaveDown") {
    const frames = { opacity: 0, transform: y(state === "leaveUp" ? -DRIFT : DRIFT) };
    go(el, frames, tween(LEAVE));
    ordered(state === "leaveDown").forEach((item, i) => go(item, frames, tween(LEAVE, i * LEAVE_STAGGER)));
  }
  return Promise.all(runs);
}

export function Reveal<T extends Tag = "div">({ as, children, ...rest }: RevealProps<T>) {
  const ref = useRef<HTMLElement>(null);
  const direction = useScrollDirection();
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let current: State = "idle";
    // True once a leave has fully finished: the section is invisible, so it may re-enter from its offset.
    let gone = false;
    // Each new state supersedes the one before; a late kit or a finished leave checks it is still current.
    let turn = 0;
    const items = () => [...el.querySelectorAll<HTMLElement>("[data-reveal-item]")].filter((n) => n.closest("[data-reveal-root]") === el);

    const set = (next: State) => {
      current = next;
      setState(next);
      const mine = ++turn;
      if (next === "hiddenBelow") {
        setNow([el, ...items()], { opacity: "0", transform: prefersReducedMotion() ? "none" : `translateY(${RISE}px)` });
        return;
      }
      if (next === "focused") {
        setNow([el, ...items()], { opacity: "1", transform: "none" });
        return;
      }
      void loadKit().then((kit) => {
        if (mine !== turn) return;
        void play(kit, el, items(), next).then(() => {
          if (mine === turn && (next === "leaveUp" || next === "leaveDown")) gone = true;
        });
      });
    };

    // Below the first view on load: hide it now, off screen.
    if (el.getBoundingClientRect().top >= window.innerHeight) {
      set("hiddenBelow");
      gone = true;
    }

    const enter = () => {
      if (isIn(current)) return;
      const up = direction.get() === "up";
      set(gone ? (up ? "enterFromAbove" : "enterFromBelow") : "settle");
      gone = false;
    };
    const leave = () => {
      if (isOut(current)) return;
      // Keyboard focus stays visible.
      if (el.contains(document.activeElement) && document.activeElement !== document.body) return;
      set(direction.get() === "up" ? "leaveDown" : "leaveUp");
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting ? entry.intersectionRect.height : 0;
        const need = Math.min(entry.boundingClientRect.height, window.innerHeight) * IN_VIEW;
        if (visible > 0 && visible >= need) enter();
        else leave();
      },
      { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    // Keyboard focus never lands on something invisible: focusing inside shows the
    // section and its items at once (a staggered fade left a focused link
    // transparent for up to half a second; browser QA, 22 Nov 2026).
    const onFocus = () => {
      if (current === "idle") return;
      set("focused");
      gone = false;
    };
    el.addEventListener("focusin", onFocus);
    return () => {
      turn++;
      observer.disconnect();
      el.removeEventListener("focusin", onFocus);
    };
  }, [direction]);

  const Tag = (as ?? "div") as unknown as ComponentType<Record<string, unknown>>;
  return (
    <Tag {...rest} ref={ref} data-reveal-root="" data-reveal={state === "idle" ? undefined : state}>
      {children}
    </Tag>
  );
}

/**
 * One item inside a Reveal: it follows the section in and out, in turn.
 * Outside a Reveal it is a plain element that never moves.
 */
export function RevealItem<T extends Tag = "div">({ as, children, ...rest }: RevealProps<T>) {
  const Tag = (as ?? "div") as unknown as ComponentType<Record<string, unknown>>;
  return (
    <Tag {...rest} data-reveal-item="">
      {children}
    </Tag>
  );
}
