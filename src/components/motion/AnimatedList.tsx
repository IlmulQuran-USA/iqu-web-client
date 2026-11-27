"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HOLD_MS } from "./HoldHeight";
import { cancelProp, prefersReducedMotion, readyKit, springOf, translateOf, tween } from "./kit";
import { Snapshot } from "./Snapshot";
import { SPRING_SNAPPY } from "./tokens";

export type AnimatedItem = { key: string; node: ReactNode; className?: string };

/** How far an arriving item rises, in px. */
const ARRIVE_RISE = 16;
/** Leavers fade this long; arrivals wait for it, so two cards never overlap. */
const LEAVE_S = 0.12;
const ARRIVE_FADE_S = 0.24;

/** Where an item was just before a change: its offset in the list, and on the page as it looked (mid-glide included). */
type Box = { top: number; left: number; width: number; height: number; x: number; y: number };

const itemsOf = (list: HTMLElement) =>
  [...list.children].filter((n): n is HTMLElement => n instanceof HTMLElement && n.dataset.listKey !== undefined);

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
 *
 * How it runs (js-headroom, 27 Nov 2026): what Motion's AnimatePresence
 * (popLayout) and layout="position" did, by hand on plain elements. Just
 * before the DOM changes (Snapshot) every item's place is measured; after it,
 * a leaver is taken out of the flow at its old place and fades, a stayer is
 * moved back to where it was and springs to its new place (FLIP), an arrival
 * fades and rises in after the leavers' fade. The animations run on the kit
 * (./kit.ts), which has arrived long before anyone can tap a filter; if it
 * has not, the list simply changes at once.
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
  const before = useRef<Map<string, Box> | null>(null);
  // Leavers fading now, each with a token, so a leaver that comes back is never removed by its old fade.
  const fading = useRef(new Map<string, object>());
  const [hold, setHold] = useState<number | null>(null);
  const signature = items.map((i) => i.key).join("|");

  // Leavers stay rendered (after the list, out of the flow) until their fade ends.
  const [last, setLast] = useState({ signature, items });
  const [leaving, setLeaving] = useState<AnimatedItem[]>([]);
  if (last.items !== items) {
    if (last.signature !== signature) {
      const keep = new Set(items.map((i) => i.key));
      const gone = new Map<string, AnimatedItem>();
      for (const item of [...leaving, ...last.items]) if (!keep.has(item.key) && !gone.has(item.key)) gone.set(item.key, item);
      setLeaving([...gone.values()]);
    }
    setLast({ signature, items });
  }

  const take = () => {
    const list = ref.current;
    if (!list) return;
    const origin = list.getBoundingClientRect();
    const boxes = new Map<string, Box>();
    for (const el of itemsOf(list)) {
      const [tx, ty] = translateOf(el);
      boxes.set(el.dataset.listKey!, {
        top: el.offsetTop,
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
        x: origin.left + el.offsetLeft + tx,
        y: origin.top + el.offsetTop + ty,
      });
    }
    before.current = boxes;
  };

  // After a filter change: pop the leavers, glide the stayers, bring in the arrivals.
  useLayoutEffect(() => {
    const list = ref.current;
    const prior = before.current;
    before.current = null;
    if (!list || !prior) return; // first render: nothing animates
    const kit = readyKit();
    const still = prefersReducedMotion();
    const leavingKeys = new Set(leaving.map((i) => i.key));
    const els = itemsOf(list);

    for (const el of els) {
      const key = el.dataset.listKey!;
      if (leavingKeys.has(key)) {
        if (fading.current.has(key)) continue; // already fading from an earlier change
        const token = {};
        fading.current.set(key, token);
        const box = prior.get(key);
        if (box) {
          Object.assign(el.style, {
            position: "absolute",
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
          });
        }
        const done = () => {
          if (fading.current.get(key) !== token) return;
          fading.current.delete(key);
          setLeaving((current) => current.filter((i) => i.key !== key));
        };
        if (!kit) {
          done();
          continue;
        }
        cancelProp(el, "opacity");
        Promise.resolve(kit.animate(el, { opacity: 0 }, tween(LEAVE_S))).then(done, done);
      } else if (fading.current.has(key)) {
        // A leaver that came back: back into the flow, and fade up again like an arrival.
        fading.current.delete(key);
        Object.assign(el.style, { position: "", top: "", left: "", width: "", height: "" });
        cancelProp(el, "opacity");
        if (kit) kit.animate(el, { opacity: 1 }, tween(ARRIVE_FADE_S, LEAVE_S));
        else el.style.opacity = "";
      }
    }

    // Measure the new places only after the leavers have left the flow; every read first, then every write.
    const origin = list.getBoundingClientRect();
    const placed = els
      .filter((el) => !leavingKeys.has(el.dataset.listKey!))
      .map((el) => ({ el, from: prior.get(el.dataset.listKey!), x: origin.left + el.offsetLeft, y: origin.top + el.offsetTop }));
    for (const { el, from, x, y } of placed) {
      if (!from) {
        if (!kit) continue;
        const rise = still ? "none" : `translateY(${ARRIVE_RISE}px)`;
        el.style.opacity = "0";
        el.style.transform = rise;
        kit.animate(
          el,
          { opacity: [0, 1], transform: [rise, "none"] },
          { opacity: tween(ARRIVE_FADE_S, LEAVE_S), transform: springOf(kit, SPRING_SNAPPY, LEAVE_S) },
        );
        continue;
      }
      if (still || !kit) continue;
      const dx = from.x - x;
      const dy = from.y - y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      cancelProp(el, "transform");
      kit.animate(el, { transform: [`translate(${dx}px, ${dy}px)`, "none"] }, springOf(kit, SPRING_SNAPPY));
    }
    // `leaving` is read as it was in the render that changed the signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // After each change of items: if the list got shorter, hold the old height for the glide.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    const previous = lastHeight.current;
    lastHeight.current = height;
    if (prefersReducedMotion() || previous === 0 || height >= previous) return;
    setHold(previous);
    const timer = window.setTimeout(() => setHold(null), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [signature]);

  const List = as;
  const Item = itemAs;
  return (
    <List ref={ref as never} className={className} style={{ position: "relative", minHeight: hold ?? undefined }}>
      <Snapshot when={signature} take={take} />
      {[...items, ...leaving].map((item) => (
        <Item key={item.key} data-list-key={item.key} className={item.className}>
          {item.node}
        </Item>
      ))}
    </List>
  );
}
