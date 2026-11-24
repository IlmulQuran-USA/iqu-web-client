import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit: `npm run db:generate` writes SQL migrations to ./drizzle from
 * src/db/schema.ts (no database needed). `npm run db:migrate` applies them to
 * the branch in DATABASE_URL; drizzle-kit does not read .env.local, so run it
 * through `vercel env pull` or with the variable set in the shell.
 * Never run migrate against the production branch from a laptop: production
 * migrations run in CI (P0 follow-up in enroll-p0.md).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
