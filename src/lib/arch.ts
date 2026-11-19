/**
 * The riwāq arch (spec §4 Direction C, DESIGN.md §1): one geometric
 * construction reused at every scale.
 *
 * Construction, in a frame 100 units wide:
 * - The opening is a two-centred pointed arch. Its arcs have radius 0.6·W and
 *   their centres sit on the springing line at 50 ± 0.1·W, where W is the
 *   opening's width. That gives a gently pointed crown, not a Gothic lancet.
 * - A hairline runs concentric to the opening, `gap` units outside it, using
 *   the same two centres with radius + gap, and touches the frame's edges.
 *   The reveal between them reads as the moulding of an arcade.
 * - Only the height changes with the aspect ratio. The arch itself never
 *   distorts, because the frame's CSS aspect-ratio always equals the viewBox.
 */

export type ArchRatio = "portrait" | "tall" | "window";

export const archRatios: Record<ArchRatio, number> = {
  portrait: 4 / 5, // instructor cards and profiles
  tall: 2 / 3, // hero and auth-page photographs
  window: 1, // a broad arch window (Home hero "spacious" layout)
};

const round = (n: number) => Math.round(n * 1000) / 1000;

export function archGeometry(ratio: number, gap = 4) {
  const width = 100 - 2 * gap;
  const offset = 0.1 * width;
  const radius = 0.6 * width;
  const outerRadius = radius + gap;
  const spring = Math.sqrt(outerRadius ** 2 - offset ** 2);
  const innerCrown = spring - Math.sqrt(radius ** 2 - offset ** 2);
  const height = 100 / ratio;

  const [s, c, r, R, h] = [spring, innerCrown, radius, outerRadius, height].map(round);
  const right = 100 - gap;

  return {
    viewBox: `0 0 100 ${h}`,
    /** Closed opening; used as the image mask. */
    opening: `M${gap} ${h}L${gap} ${s}A${r} ${r} 0 0 1 50 ${c}A${r} ${r} 0 0 1 ${right} ${s}L${right} ${h}Z`,
    /** The opening's own edge, open at the base; the monogram's hairline. */
    edge: `M${gap} ${h}L${gap} ${s}A${r} ${r} 0 0 1 50 ${c}A${r} ${r} 0 0 1 ${right} ${s}L${right} ${h}`,
    /** Open hairline (no base line); used as the stroke. */
    hairline: `M0 ${h}L0 ${s}A${R} ${R} 0 0 1 50 0A${R} ${R} 0 0 1 100 ${s}L100 ${h}`,
    aspectRatio: `100 / ${h}`,
  };
}

/** Mask image for the arch opening, for CSS `mask-image`. */
export function archMask(ratio: number): string {
  const { viewBox, opening } = archGeometry(ratio);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="none"><path d="${opening}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const HONORIFICS = new Set([
  "md",
  "mufti",
  "maulana",
  "mawlana",
  "moulana",
  "hafiz",
  "hafez",
  "hafiza",
  "hafeza",
  "qari",
  "shaykh",
  "sheikh",
  "ustadh",
  "ustadha",
  "imam",
  "dr",
]);

/**
 * Initials for the monogram fallback: the first and last name words, without
 * honorifics. Several instructors have four-part names (spec §9.2) and
 * names are Unicode, so this splits by code point, never by byte.
 */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[.,()]/g, ""))
    .filter((w) => w && !HONORIFICS.has(w.toLowerCase()));
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}
