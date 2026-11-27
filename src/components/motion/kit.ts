import { EASE, type SpringToken } from "./tokens";

/*
 * Loads the animation kit (./kit-impl: Motion's mini animate and its spring
 * generator) once, after the first paint. Until it arrives nothing needs it:
 * the server HTML is complete and visible, hiding a section below the fold is
 * a plain style write, and the first scroll or filter tap is always later
 * than an idle callback (js-headroom, 27 Nov 2026).
 *
 * Why not Motion's components: LazyMotion with `m` elements put Motion's
 * VisualElement and value engine (about 17 KB gz) into the first load of
 * every page that reveals, and the layout features (domMax, about 16 KB)
 * after it on /courses and /instructors. The same animations, run through
 * mini animate on plain elements, need neither.
 */

type KitModule = typeof import("./kit-impl");
export type Kit = { animate: KitModule["animate"]; spring: KitModule["spring"] };

let pending: Promise<Kit> | null = null;
let ready: Kit | null = null;

export function loadKit(): Promise<Kit> {
  pending ??= import("./kit-impl").then((m) => (ready = { animate: m.animate, spring: m.spring }));
  return pending;
}

/** The kit if it has arrived, else null (and it starts loading). A filter glide that cannot start now jumps instead of starting late. */
export function readyKit(): Kit | null {
  if (!ready) void loadKit();
  return ready;
}

/** Start loading when the browser is idle after the first paint. */
export function preloadKit() {
  const start = () => void loadKit();
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 1500 });
  else globalThis.setTimeout(start, 200);
}

/** Motion's reducedMotion "user": transforms and layout moves are skipped; opacity still changes. */
export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Curve = { duration: number; ease: (progress: number) => number };
const curves = new Map<string, Curve>();

/**
 * A spring token as mini-animate options: Motion's own spring generator,
 * sampled into an easing curve. Sampled here rather than passed as
 * `type: spring`, because mini animate then settles the spring on a 0–100
 * scale and stops it up to half a percent short: on a 1,000 px filter glide
 * that left a visible 2–5 px snap at the end (browser QA, 27 Nov 2026). These
 * rest thresholds settle it to well under a pixel, as Motion's components did.
 */
export function springOf(kit: Kit, token: SpringToken, delay = 0) {
  const id = `${token.visualDuration}/${token.bounce}`;
  let curve = curves.get(id);
  if (!curve) {
    const generator = kit.spring({
      keyframes: [0, 1],
      visualDuration: token.visualDuration,
      bounce: token.bounce,
      restDelta: 0.0002,
      restSpeed: 0.002,
    } as Parameters<Kit["spring"]>[0]);
    let ms = 0;
    while (!generator.next(ms).done && ms < 5000) ms += 10;
    const total = ms;
    curve = { duration: total / 1000, ease: (p) => (p >= 1 ? 1 : (generator.next(p * total).value as number)) };
    curves.set(id, curve);
  }
  return { duration: curve.duration, ease: curve.ease, delay };
}

/** A tween in mini-animate options (seconds; the site's ease). */
export const tween = (duration: number, delay = 0) => ({ duration, delay, ease: [...EASE] as [number, number, number, number] });

/** Stops every running animation on these elements and writes the given styles at once (Motion's duration-0 states). */
export function setNow(elements: readonly HTMLElement[], style: { opacity?: string; transform?: string }) {
  for (const el of elements) {
    for (const a of el.getAnimations()) a.cancel();
    if (style.opacity !== undefined) el.style.opacity = style.opacity;
    if (style.transform !== undefined) el.style.transform = style.transform;
  }
}

/** Stops the running animations of one property on an element, leaving the others (an entering card keeps fading in while its glide restarts). */
export function cancelProp(el: HTMLElement, property: string) {
  for (const a of el.getAnimations()) {
    const effect = a.effect as KeyframeEffect | null;
    if (effect?.getKeyframes().some((frame) => property in frame)) a.cancel();
  }
}

/** The element's current translation in px (mid-glide included), from its computed transform. */
export function translateOf(el: HTMLElement): [number, number] {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return [0, 0];
  const matrix = new DOMMatrixReadOnly(transform);
  return [matrix.m41, matrix.m42];
}
