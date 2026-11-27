import type { BillingRepo } from "./billing.ts";
import type { PeopleRepo } from "./people.ts";
import type { EnrollmentWriter, RegistrationsRepo } from "./registrations.ts";
import type { ScheduleRepo } from "./schedule.ts";

/*
 * The one data interface every portal page reads (plan
 * frontend-portal-admin-plan.md §1). Two adapters implement it:
 *   mock  src/data/mock: invented, deterministic, anchored to today
 *   live  src/data/live: Neon (Drizzle), Stripe, Clerk, Zoom (later)
 * Pages import only this interface (through src/data/index.ts), never an
 * adapter. Each later batch adds its domains here (messages, homework,
 * coupons, ledger, donations, …) with the same pattern.
 */

export type DataSource = {
  mode: "mock" | "live";
  people: PeopleRepo;
  schedule: ScheduleRepo;
  billing: BillingRepo;
  registrations: RegistrationsRepo;
  enrollment: EnrollmentWriter;
};

export * from "./billing.ts";
export * from "./people.ts";
export * from "./registrations.ts";
export * from "./schedule.ts";
