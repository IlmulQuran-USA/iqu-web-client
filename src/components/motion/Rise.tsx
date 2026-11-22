import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

type Tag = "div" | "p" | "h1" | "ul" | "li";

/**
 * The hero's entrance (owner, 22 Nov 2026): each part rises 24 px into place
 * on a spring as the page first paints, `order` × 80 ms after the first.
 * Transform only: everything is at full opacity from the first paint, so the
 * LCP never waits for it.
 *
 * Deliberately CSS (globals.css [data-rise]), not Motion: Motion can only
 * start after hydration, which on a throttled phone came about 3 s after
 * the first paint (measured 22 Nov 2026), so the hero would sit 24 px low and
 * then jump while the visitor was already reading. The keyframe plays with
 * the first paint, with no JavaScript. Under reduced motion it is simply in
 * place.
 */
export function Rise<T extends Tag = "div">({
  as,
  order = 0,
  style,
  children,
  ...rest
}: ComponentPropsWithoutRef<T> & { as?: T; order?: number; children: ReactNode }) {
  const Component = (as ?? "div") as "div";
  return (
    <Component
      {...(rest as ComponentPropsWithoutRef<"div">)}
      data-rise=""
      style={{ ...(style as CSSProperties), "--rise-order": order } as CSSProperties}
    >
      {children}
    </Component>
  );
}
