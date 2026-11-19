import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * The eight-point khatam girih lattice (DESIGN.md §1): the one element taken
 * from Direction B, drawn as a 1 px line. Used behind the Home giving band
 * (at 4% opacity, spec §7.1 section 8), the donation hero and the portal
 * empty state only.
 *
 * Each 64-unit tile holds an eight-point star (two squares, one turned 45°)
 * whose points join the neighbouring tiles, so the stars link into a lattice.
 * The stroke is currentColor; set colour and opacity on the wrapper.
 */
export function GirihLattice({ className, tile = 64 }: { className?: string; tile?: number }) {
  // React ids may contain characters that are unsafe inside url(#…).
  const id = `girih-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const t = tile;
  const c = t / 2;
  const a = t / 4; // half-size of the axis-aligned square
  const r = Math.SQRT2 * a; // reach of the turned square's points
  const n = (v: number) => Math.round(v * 100) / 100;

  const star = [
    `M${n(c - a)} ${n(c - a)}H${n(c + a)}V${n(c + a)}H${n(c - a)}Z`,
    `M${c} ${n(c - r)}L${n(c + r)} ${c}L${c} ${n(c + r)}L${n(c - r)} ${c}Z`,
  ];
  const links = [
    // turned square's points to the tile edges
    `M${c} 0V${n(c - r)}M${n(c + r)} ${c}H${t}M${c} ${n(c + r)}V${t}M0 ${c}H${n(c - r)}`,
    // square's corners to the tile corners
    `M0 0L${n(c - a)} ${n(c - a)}M${t} 0L${n(c + a)} ${n(c - a)}M${t} ${t}L${n(c + a)} ${n(c + a)}M0 ${t}L${n(c - a)} ${n(c + a)}`,
  ];

  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", className)}>
      <defs>
        <pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse">
          <path d={[...star, ...links].join("")} fill="none" stroke="currentColor" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
