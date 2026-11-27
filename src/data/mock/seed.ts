/*
 * Deterministic randomness for the mock data set. Every choice in src/data/mock
 * comes from here, never from Math.random() or the clock, so the same day
 * gives the same data and tests can pin it.
 */

/** mulberry32: a small, fast, well-spread 32-bit generator. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string (FNV-1a), to seed per-record choices. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The fixed seed of the whole data set. */
export const SEED = 0x1c0a2026;

export function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

export function int(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Picks a value by weight: [[value, weight], …]. */
export function weighted<T>(random: () => number, table: readonly (readonly [T, number])[]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [value, w] of table) {
    r -= w;
    if (r < 0) return value;
  }
  return table[table.length - 1][0];
}
