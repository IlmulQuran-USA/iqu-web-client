import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/*
 * Database client. SERVER ONLY.
 *
 * - Neon over WebSockets (`neon-serverless`), not the HTTP driver: enrollment
 *   writes the registration, its review reasons, the coupon redemption, the
 *   family and the outbox rows in ONE transaction (architecture §2.1), and only
 *   the WebSocket pool supports interactive transactions. Node 24 has a global
 *   WebSocket, so no `ws` package is needed.
 * - Lazy: nothing connects at import time, so `next build` works before the
 *   Neon integration is connected (no DATABASE_URL yet). No Proxy wrapper.
 * - Each Vercel environment gets its own Neon branch through the integration
 *   (staging, dev, one per preview): see .env.example and enroll-p0.md.
 */

export type Db = NeonDatabase<typeof schema>;

let db: Db | null = null;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set. Connect the Neon integration to this Vercel project (enroll-p0.md).");
  db = drizzle(new Pool({ connectionString: url }), { schema });
  return db;
}

export { schema };
