import { and, gte, lt, sql } from "drizzle-orm";
import { eligibilityBlocks } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";

/*
 * Blocked-submission counts for the 9 PM summary (IQU_Eligibility::record_block
 * EL:265-279 and blocks_since EL:282-295). Per hour (UTC), mode and country:
 * no IP and nothing about the person. Kept 192 hours (8 days, EL:27), pruned
 * on write as the plugin does.
 */

const KEEP_HOURS = 192;
const HOUR_MS = 3_600_000;

const hourOf = (at: Date) => new Date(Math.floor(at.getTime() / HOUR_MS) * HOUR_MS);

/** EL:265-279: one more block (monitor: would be blocked) for this country and hour. */
export async function recordBlock(db: Queryable, country: string, mode: "monitor" | "enforce" | string, now: Date): Promise<void> {
  const c = /^[A-Z]{2}$/.test(country) ? country : "??";
  const m = mode === "enforce" ? "enforce" : "monitor";
  await db
    .insert(eligibilityBlocks)
    .values({ hour: hourOf(now), mode: m, country: c, count: 1 })
    .onConflictDoUpdate({
      target: [eligibilityBlocks.hour, eligibilityBlocks.mode, eligibilityBlocks.country],
      set: { count: sql`${eligibilityBlocks.count} + 1` },
    });
  await db.delete(eligibilityBlocks).where(lt(eligibilityBlocks.hour, new Date(hourOf(now).getTime() - KEEP_HOURS * HOUR_MS)));
}

export type BlockCounts = { enforce: [string, number][]; monitor: [string, number][] };

/**
 * EL:282-295: the counts since a moment, the hour of `since` included (the plugin
 * compares 'YmdH' keys), largest first. Equal counts keep the order in which the
 * countries first appear (hour, then country), like PHP's stable arsort.
 */
export async function blocksSince(db: Queryable, since: Date, now: Date): Promise<BlockCounts> {
  const rows = await db
    .select()
    .from(eligibilityBlocks)
    .where(and(gte(eligibilityBlocks.hour, hourOf(since)), lt(eligibilityBlocks.hour, new Date(now.getTime() + HOUR_MS))))
    .orderBy(eligibilityBlocks.hour, eligibilityBlocks.country);
  const out: Record<"enforce" | "monitor", Map<string, number>> = { enforce: new Map(), monitor: new Map() };
  for (const r of rows) {
    const bucket = out[r.mode === "enforce" ? "enforce" : "monitor"];
    bucket.set(r.country, (bucket.get(r.country) ?? 0) + r.count);
  }
  const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { enforce: sorted(out.enforce), monitor: sorted(out.monitor) };
}

/** EL:298-303: "3 (PK 2, IN 1)". */
export function formatCounts(counts: [string, number][]): string {
  const total = counts.reduce((s, [, n]) => s + n, 0);
  return `${total} (${counts.map(([c, n]) => `${c} ${n}`).join(", ")})`;
}
