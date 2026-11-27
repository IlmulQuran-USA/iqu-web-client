import { portalData } from "../lib/site-env.ts";
import type { DataSource } from "./contracts/index.ts";
import { createLiveSource } from "./live/index.ts";
import { createMockSource } from "./mock/index.ts";

/*
 * The one entry point to portal data (SERVER ONLY; plan
 * frontend-portal-admin-plan.md §1). PORTAL_DATA picks the adapter
 * (src/lib/site-env.ts portalData): mock on dev, live once connected, and
 * nothing at all on a site where the portal is off.
 *
 * Fences (src/data/fences.test.ts + eslint no-restricted-imports):
 *   - pages and components import @/data or @/data/contracts, never an adapter;
 *   - public pages never import @/data at all. The one exception is the
 *     /enroll server action, which writes through `enrollment` (no data is read
 *     back onto a public page).
 */

let mock: DataSource | null = null;
let live: DataSource | null = null;

export function getData(env: Record<string, string | undefined> = process.env): DataSource {
  const mode = portalData(env);
  if (mode === "mock") return (mock ??= createMockSource());
  if (mode === "live") return (live ??= createLiveSource());
  throw new Error("The portal is off on this site (PORTAL_DATA).");
}

export type * from "./contracts/index.ts";
