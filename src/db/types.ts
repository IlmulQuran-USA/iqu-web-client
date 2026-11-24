import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema.ts";

/*
 * Any Drizzle Postgres database with our schema: Neon in the app
 * (src/db/index.ts), PGlite in the tests. The enrollment code takes this
 * type, so the same functions run unchanged on both.
 */

export type Schema = typeof schema;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the query-result type differs per driver (Neon, PGlite)
export type AnyDb = PgDatabase<any, Schema, ExtractTablesWithRelations<Schema>>;

export type AnyTx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

/** A database or an open transaction: every query helper accepts both. */
export type Queryable = AnyDb | AnyTx;
