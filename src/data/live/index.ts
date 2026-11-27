import type { DataSource } from "../contracts/index.ts";

/*
 * The live adapter (SERVER ONLY). Each repository is the contract in
 * src/data/contracts, implemented later over (plan frontend-portal-admin-plan.md §1.2):
 *   people        Clerk users (roles in publicMetadata) + Neon families,
 *                 registrations and a new teachers table
 *   schedule      new classes / class_sessions / zoom_events tables, fed by the
 *                 Zoom webhook (spec §7D.8); thresholds from settings
 *   billing       Neon families, family_members, payments, arrears (they
 *                 exist: src/db/schema.ts) + Stripe reads
 *   registrations Neon registrations + review_reasons (exist)
 *   enrollment    submitEnrollmentCore (src/lib/server/enroll/submit.ts),
 *                 already live behind enrollConfig()
 * Until a repository is written it throws, so nothing silently shows
 * empty data: PORTAL_DATA=live is only set when every page it serves is
 * connected.
 */

function notConnected(domain: string): never {
  throw new Error(`The live ${domain} adapter is not connected yet (src/data/live). Keep PORTAL_DATA=mock on dev.`);
}

export function createLiveSource(): DataSource {
  const missing = (domain: string) =>
    new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => notConnected(`${domain}.${String(prop)}`)) });
  return {
    mode: "live",
    people: missing("people") as DataSource["people"],
    schedule: missing("schedule") as DataSource["schedule"],
    billing: missing("billing") as DataSource["billing"],
    registrations: missing("registrations") as DataSource["registrations"],
    enrollment: missing("enrollment") as DataSource["enrollment"],
  };
}
