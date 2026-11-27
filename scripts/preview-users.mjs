#!/usr/bin/env node
/*
 * The four preview accounts in Clerk (portal Batch 1; plan
 * frontend-portal-admin-plan.md §3.1). Run BY HAND, only once Clerk keys
 * exist; never at build time.
 *
 *   CLERK_SECRET_KEY=sk_… PREVIEW_DEFAULT_PASSWORD=… node scripts/preview-users.mjs          create or update
 *   CLERK_SECRET_KEY=sk_… node scripts/preview-users.mjs --delete                          delete all four (cutover runbook S14a)
 *
 * Each user gets the password from PREVIEW_DEFAULT_PASSWORD (read from the
 * environment only; never printed, logged or written anywhere) and its roles
 * and record ids in public_metadata, which the session token carries as the
 * `metadata` claim (src/lib/auth/clerk.ts). Idempotent: an existing user is
 * updated, never duplicated. Prints emails and roles only.
 */

const API = "https://api.clerk.com/v1";
const secret = process.env.CLERK_SECRET_KEY?.trim();
const remove = process.argv.includes("--delete");

const USERS = [
  { email: "admin@ilmulquranus.org", first: "Preview", last: "Admin", metadata: { roles: ["admin", "billing_admin"] } },
  { email: "teacher@ilmulquranus.org", first: "Imran", last: "Chowdhury", metadata: { roles: ["teacher"], teacherId: "t-imran" } },
  { email: "parent@ilmulquranus.org", first: "Amina", last: "Siddiqui", metadata: { roles: ["parent"], familyId: "f-siddiqui" } },
  { email: "student@ilmulquranus.org", first: "Farhana", last: "Karim", metadata: { roles: ["student"], familyId: "f-karim", studentId: "s-farhana" } },
];

if (!secret) {
  console.error("CLERK_SECRET_KEY is not set: nothing to do.");
  process.exit(2);
}
const password = process.env.PREVIEW_DEFAULT_PASSWORD ?? "";
if (!remove && password.length < 12) {
  console.error("PREVIEW_DEFAULT_PASSWORD is missing or shorter than 12 characters.");
  process.exit(2);
}

async function clerk(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

for (const u of USERS) {
  const found = await clerk("GET", `/users?email_address=${encodeURIComponent(u.email)}`);
  const existing = Array.isArray(found) ? found[0] : null;
  if (remove) {
    if (existing) await clerk("DELETE", `/users/${existing.id}`);
    console.log(`${existing ? "deleted" : "not found"}  ${u.email}`);
    continue;
  }
  if (existing) {
    await clerk("PATCH", `/users/${existing.id}`, { first_name: u.first, last_name: u.last, password, skip_password_checks: true, public_metadata: u.metadata });
    console.log(`updated  ${u.email}  ${u.metadata.roles.join(", ")}`);
  } else {
    await clerk("POST", "/users", {
      email_address: [u.email],
      first_name: u.first,
      last_name: u.last,
      password,
      skip_password_checks: true,
      public_metadata: u.metadata,
    });
    console.log(`created  ${u.email}  ${u.metadata.roles.join(", ")}`);
  }
}
