/**
 * npm run migrate:wp -- --file <snapshot.json> [--dry-run] [--allow-skips] [--json] [--pglite <dir>]
 *
 * Imports a WordPress snapshot (tooling/wp-export.php) into the database at
 * DATABASE_URL (Neon), or into a local PGlite folder with --pglite (a rehearsal
 * on this machine; its migrations are applied first). See
 * src/lib/server/migrate/importer.ts for the rules.
 *
 *   --dry-run      every write runs inside one transaction, the reconcile report
 *                  is read back, then everything is rolled back
 *   --allow-skips  accept rows the importer had to skip (listed with reasons)
 *   --json         print the report as JSON
 *
 * Exit code 0 only when the report has no mismatch. The snapshot holds family
 * data: keep it out of the repository and delete it after the switch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { importSnapshot, type ImportReport } from "../src/lib/server/migrate/importer.ts";
import { snapshotSchema } from "../src/lib/server/migrate/snapshot.ts";
import * as schema from "../src/db/schema.ts";
import type { AnyDb } from "../src/db/types.ts";

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "allow-skips": { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    pglite: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

if (!values.file) fail("Usage: npm run migrate:wp -- --file <snapshot.json> [--dry-run] [--allow-skips] [--json] [--pglite <dir>]");

const parsed = snapshotSchema.safeParse(JSON.parse(readFileSync(values.file, "utf8")));
if (!parsed.success) fail(`Not a snapshot from tooling/wp-export.php:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);

async function database(): Promise<{ db: AnyDb; label: string; close: () => Promise<void> }> {
  if (values.pglite) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = await PGlite.create(values.pglite);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
    return { db: db as unknown as AnyDb, label: `PGlite ${values.pglite}`, close: () => client.close() };
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) fail("DATABASE_URL is not set (or pass --pglite <dir> for a local rehearsal).");
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }) as unknown as AnyDb, label: `Neon ${new URL(url).host}`, close: () => pool.end() };
}

function print(r: ImportReport, label: string): void {
  const line = (s = "") => console.log(s);
  line(`${r.dryRun ? "DRY RUN (rolled back)" : "IMPORT"} into ${label} · NEXT_PUBLIC_SITE_ENV=${process.env.NEXT_PUBLIC_SITE_ENV ?? "(unset)"}`);
  line(`Snapshot: ${r.snapshot.site} · exported ${r.snapshot.exportedAt} · plugin ${r.snapshot.pluginVersion}`);
  line(`Stripe ids: ${r.stripe.mode} (${r.stripe.liveIdsInSnapshot} live in the snapshot) · families with a subscription ${r.stripe.familiesWithSubscription} · by customer only ${r.stripe.familiesLinkedByCustomer} · members with an item ${r.stripe.membersWithItem}`);
  line();
  line("Rows                                              source  inserted  updated  unchanged  skipped");
  for (const t of r.tables) {
    line(`  ${t.table.padEnd(48)}${String(t.source).padStart(6)}${String(t.inserted).padStart(10)}${String(t.updated).padStart(9)}${String(t.unchanged).padStart(11)}${String(t.skipped.length).padStart(9)}`);
    for (const s of t.skipped) line(`      skipped ${s.key}: ${s.reason}`);
  }
  line();
  line("Money                                   MySQL    snapshot    imported");
  for (const m of r.money) line(`  ${m.ok ? "✓" : "✗"} ${m.name.padEnd(34)}${String(m.source).padStart(10)}${String(m.snapshot).padStart(12)}${String(m.target).padStart(12)}`);
  line();
  line(`Next ids: ${Object.entries(r.sequences).map(([t, n]) => `${t} ${n}`).join(" · ")}`);
  if (r.warnings.length) {
    line();
    line(`Warnings (${r.warnings.length}):`);
    for (const w of r.warnings) line(`  - ${w}`);
  }
  line();
  if (r.mismatches.length) {
    line(`MISMATCHES (${r.mismatches.length}) — nothing was kept:`);
    for (const m of r.mismatches) line(`  ✗ ${m}`);
  } else line(r.dryRun ? "OK: everything reconciles. Nothing was written (dry run)." : "OK: everything reconciles and was written.");
}

const { db, label, close } = await database();
try {
  const report = await importSnapshot(db, parsed.data, { dryRun: values["dry-run"], siteEnv: process.env.NEXT_PUBLIC_SITE_ENV, allowSkips: values["allow-skips"] });
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else print(report, label);
  process.exitCode = report.ok ? 0 : 1;
} finally {
  await close();
}
