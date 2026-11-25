import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

/*
 * The schema's constraints, tested against real Postgres (PGlite, in
 * process): the generated migrations in ./drizzle are applied exactly as
 * they will be on Neon, then every house rule is tried both ways.
 * No network, no Neon branch needed.
 */

let db: PGlite;

before(async () => {
  db = await PGlite.create();
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
});

after(async () => {
  await db.close();
});

async function ok(sql: string, params: unknown[] = []) {
  return db.query(sql, params);
}

async function refused(sql: string, constraint: string, params: unknown[] = []) {
  await assert.rejects(db.query(sql, params), (e: Error) => {
    assert.match(e.message, new RegExp(constraint), `expected ${constraint}, got: ${e.message}`);
    return true;
  });
}

/** A minimal valid registration; `cols` overrides or adds columns. */
async function registration(cols: Record<string, unknown> = {}): Promise<number> {
  const row = { program: "monthly", first_name: "Ayesha", last_name: "Rahman", email: "parent@example.com", ...cols };
  const keys = Object.keys(row);
  const res = await db.query<{ id: number }>(
    `INSERT INTO registrations (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
    Object.values(row),
  );
  return Number(res.rows[0].id);
}

async function family(cols: Record<string, unknown> = {}): Promise<number> {
  const row = { mode: "test", contact_email: "parent@example.com", student_type: "new", ...cols };
  const keys = Object.keys(row);
  const res = await db.query<{ id: number }>(
    `INSERT INTO families (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
    Object.values(row),
  );
  return Number(res.rows[0].id);
}

/* ── Shape ───────────────────────────────────────────────────────────── */

test("all 17 tables exist", async () => {
  const res = await ok(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`);
  assert.deepEqual(
    (res.rows as { table_name: string }[]).map((r) => r.table_name),
    [
      "arrears", "audit_log", "coupon_redemptions", "coupons", "discount_ledger", "eligibility_blocks", "families", "family_members",
      "idempotency", "outbox", "payments", "rate_limits", "registrations", "review_reasons", "settings", "stripe_events", "waitlist",
    ],
  );
});

test("no IP address column anywhere (owner decision 1)", async () => {
  const res = await ok(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND (column_name ~ '(^|_)ip($|_)' OR column_name ILIKE '%ip_addr%') AND column_name <> 'country_ip'`,
  );
  assert.deepEqual(res.rows, []);
});

test("every money column is integer cents, never a float or numeric", async () => {
  const res = await ok(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name LIKE '%cents%' ORDER BY 1, 2`,
  );
  // families 4 · registrations 6 · payments 3 · members, arrears, audit, coupons, ledger 1 each.
  // A new money column changes this count on purpose: keep it integer cents.
  assert.equal(res.rows.length, 18);
  for (const r of res.rows as { table_name: string; column_name: string; data_type: string }[]) {
    assert.equal(r.data_type, "integer", `${r.table_name}.${r.column_name}`);
  }
  const floats = await ok(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('real', 'double precision', 'numeric')`,
  );
  assert.deepEqual(floats.rows, []);
});

test("every Stripe-bearing table has a test/live mode column", async () => {
  for (const table of ["families", "family_members", "payments", "arrears", "stripe_events"]) {
    const res = await ok(
      `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'mode'`,
      [table],
    );
    assert.equal((res.rows[0] as { is_nullable: string } | undefined)?.is_nullable, "NO", table);
  }
  await refused(`INSERT INTO families (mode, contact_email, student_type) VALUES ('production', 'a@b.co', 'new')`, "families_mode");
});

/* ── Registrations ───────────────────────────────────────────────────── */

test("a registration keeps its WordPress id (the IQU number) on import", async () => {
  const id = await registration({ id: 9001, created_via: "import" });
  assert.equal(id, 9001);
});

test("registration values are checked", async () => {
  await refused(`INSERT INTO registrations (program, first_name, last_name, email) VALUES ('online', 'A', 'B', 'a@b.co')`, "registrations_program");
  await assert.rejects(registration({ status: "done" }), /registrations_status/);
  await assert.rejects(registration({ quran_level: "expert" }), /registrations_quran_level/);
  await registration({ quran_level: "beginner" }); // the plugin's old levels stay readable
  await assert.rejects(registration({ session_minutes: 35 }), /registrations_session_minutes/);
  await registration({ session_minutes: 45 }); // legacy value on imported rows
  await assert.rejects(registration({ days_per_week: 8 }), /registrations_days/);
  await assert.rejects(registration({ aid_level: "40" }), /registrations_aid_level/);
  await assert.rejects(registration({ marketing_consent: "yes" }), /registrations_marketing_consent/);
});

test("money is never negative", async () => {
  await assert.rejects(registration({ discount_cents: -1 }), /registrations_money/);
  await assert.rejects(registration({ payment_cents: -500 }), /registrations_money/);
});

test("the availability window ends after it starts", async () => {
  await registration({ time_start: "16:00", time_end: "18:00" });
  await assert.rejects(registration({ time_start: "18:00", time_end: "16:00" }), /registrations_window/);
  await assert.rejects(registration({ time_start: "16:00", time_end: "16:00" }), /registrations_window/);
});

test("phones are E.164 and countries are two letters", async () => {
  await registration({ whatsapp_e164: "+12145550123", country_res_code: "US" });
  await assert.rejects(registration({ whatsapp_e164: "214-555-0123" }), /registrations_e164/);
  await assert.rejects(registration({ country_res_code: "us" }), /registrations_country_codes/);
});

test("coupon rules: declared, never with the Special plan; a fund without an agreed fee is an admin discount", async () => {
  const c = await ok(`INSERT INTO coupons (code, course_key, discount_type, value_percent) VALUES ('QAD-260826-M4P9-100', 'qaidah', 'percent', 100) RETURNING id`);
  const couponId = Number((c.rows[0] as { id: number }).id);
  await assert.rejects(registration({ coupon_id: couponId }), /registrations_coupon_declared/);
  await registration({ coupon_id: couponId, zakat_declaration: true });
  await assert.rejects(registration({ coupon_id: couponId, zakat_declaration: true, special_plan: true }), /registrations_special_xor_coupon/);
  // Migration 0002: the fund also places an admin discount (discount-ledger.php:143-144), so it may stand alone.
  await registration({ agreed_fee_fund: "zakat", discount_cents: 2000 });
  await registration({ agreed_fee_fund: "special", agreed_fee_cents: 2000 });
  await assert.rejects(registration({ agreed_fee_fund: "both" }), /registrations_agreed_fund/);
});

test("a submit id is used once (idempotent submit)", async () => {
  await registration({ submit_id: "0123456789abcdef-1" });
  await assert.rejects(registration({ submit_id: "0123456789abcdef-1" }), /registrations_submit_id_uq/);
});

/* ── Coupons ─────────────────────────────────────────────────────────── */

test("coupon format, type and value agree", async () => {
  await refused(`INSERT INTO coupons (code, course_key, discount_type, value_percent) VALUES ('qad-1', 'qaidah', 'percent', 50)`, "coupons_code_format");
  await refused(`INSERT INTO coupons (code, course_key, discount_type, value_percent) VALUES ('HFZ-260826-X7K2-80', 'hifz', 'percent', 120)`, "coupons_value_matches_type");
  await refused(`INSERT INTO coupons (code, course_key, discount_type, value_percent) VALUES ('ARB-260826-B2T7-F25', 'arabic', 'fixed', 25)`, "coupons_value_matches_type");
  await ok(`INSERT INTO coupons (code, course_key, discount_type, value_cents) VALUES ('ARB-260826-B2T7-F25', 'arabic', 'fixed', 2500)`);
  await refused(`INSERT INTO coupons (code, course_key, discount_type, value_cents) VALUES ('ARB-260826-B2T7-F25', 'arabic', 'fixed', 2500)`, "coupons_code_uq");
});

test("a coupon is redeemed once per enrollment", async () => {
  const c = await ok(`INSERT INTO coupons (code, course_key, discount_type, value_percent) VALUES ('ALL-260826-Q7RT-50', 'ALL', 'percent', 50) RETURNING id`);
  const couponId = Number((c.rows[0] as { id: number }).id);
  const reg = await registration({ coupon_id: couponId, zakat_declaration: true });
  await ok(`INSERT INTO coupon_redemptions (coupon_id, registration_id) VALUES ($1, $2)`, [couponId, reg]);
  await refused(`INSERT INTO coupon_redemptions (coupon_id, registration_id) VALUES ($1, $2)`, "coupon_redemptions_coupon_id_registration_id_pk", [couponId, reg]);
});

/* ── Families and billing ────────────────────────────────────────────── */

test("a family's net is monthly minus discount, never negative", async () => {
  await family({ monthly_cents: 4800, discount_cents: 2160, net_cents: 2640 });
  await assert.rejects(family({ monthly_cents: 4800, discount_cents: 2160, net_cents: 4800 }), /families_net/);
  await assert.rejects(family({ monthly_cents: 4800, discount_cents: 5000, net_cents: -200 }), /families_money/);
});

test("one family per Stripe customer and subscription in a mode; test and live never mix", async () => {
  await family({ stripe_customer_id: "cus_A1", stripe_subscription_id: "sub_A1" });
  await assert.rejects(family({ stripe_customer_id: "cus_A1" }), /families_customer_uq/);
  await assert.rejects(family({ stripe_subscription_id: "sub_A1" }), /families_subscription_uq/);
  await family({ mode: "live", stripe_customer_id: "cus_A1" }); // same id in the other mode is another object
  await assert.rejects(family({ stripe_customer_id: "acct_1" }), /families_customer_id/);
});

test("a plugin billing account keeps its id, so iqu_account_id metadata still matches", async () => {
  const id = await family({ id: 41, mode: "live", source: "wp_import", stripe_customer_id: "cus_WP41", stripe_subscription_id: "sub_WP41" });
  assert.equal(id, 41);
});

test("a child belongs to one family per mode", async () => {
  const fam = await family();
  const reg = await registration();
  await ok(`INSERT INTO family_members (family_id, registration_id, mode, amount_cents) VALUES ($1, $2, 'test', 4800)`, [fam, reg]);
  await refused(`INSERT INTO family_members (family_id, registration_id, mode, amount_cents) VALUES ($1, $2, 'test', 4800)`, "family_members_registration_uq", [fam, reg]);
  await refused(`INSERT INTO family_members (family_id, registration_id, mode, amount_cents) VALUES ($1, $2, 'live', -1)`, "family_members_amount", [fam, reg]);
});

test("payments: one row per invoice, refunds within the paid amount, links only to Stripe", async () => {
  const fam = await family();
  const insert = `INSERT INTO payments (stripe_invoice_id, family_id, mode, status, amount_paid_cents, amount_refunded_cents, hosted_invoice_url)
                  VALUES ($1, $2, 'test', 'paid', $3, $4, $5)`;
  await ok(insert, ["in_1", fam, 4800, 0, "https://invoice.stripe.com/i/acct_1/test_x"]);
  await refused(insert, "payments_invoice_uq", ["in_1", fam, 4800, 0, null]);
  await refused(insert, "payments_money", ["in_2", fam, 4800, 5000, null]);
  await refused(insert, "payments_stripe_links", ["in_3", fam, 4800, 0, "https://evil.example.com/stripe.com/"]);
  await refused(insert, "payments_invoice_id", ["inv_4", fam, 4800, 0, null]);
});

test("arrears: first of the month, positive, a waiver needs a reason", async () => {
  const fam = await family();
  await ok(`INSERT INTO arrears (mode, family_id, month, amount_cents) VALUES ('test', $1, '2026-12-01', 4800)`, [fam]);
  await refused(`INSERT INTO arrears (mode, family_id, month, amount_cents) VALUES ('test', $1, '2026-12-15', 4800)`, "arrears_month_first", [fam]);
  await refused(`INSERT INTO arrears (mode, family_id, month, amount_cents, status) VALUES ('test', $1, '2027-01-01', 4800, 'waived')`, "arrears_waive_reason", [fam]);
});

test("a Stripe event is processed once", async () => {
  await ok(`INSERT INTO stripe_events (stripe_event_id, mode, type) VALUES ('evt_1', 'test', 'invoice.paid')`);
  await refused(`INSERT INTO stripe_events (stripe_event_id, mode, type) VALUES ('evt_1', 'test', 'invoice.paid')`, "stripe_events_pkey");
  await refused(`INSERT INTO stripe_events (stripe_event_id, mode, type, result) VALUES ('evt_2', 'test', 'invoice.paid', 'maybe')`, "stripe_events_result");
});

/* ── Zakat / Special ledger ──────────────────────────────────────────── */

test("the ledger has one row per student, month and fund, on the 1st, positive", async () => {
  const reg = await registration({ agreed_fee_fund: "zakat", agreed_fee_cents: 0 });
  const insert = `INSERT INTO discount_ledger (month, registration_id, kind, reason, amount_cents, source) VALUES ($1, $2, $3, $4, $5, $6)`;
  await ok(insert, ["2026-11-01", reg, "zakat", "agreed_fee", 4800, "wp_import"]);
  await refused(insert, "discount_ledger_month_uq", ["2026-11-01", reg, "zakat", "agreed_fee", 4800, "monthly"]);
  await ok(insert, ["2026-11-01", reg, "special", "special_plan", 800, "monthly"]); // the other fund is its own row
  await refused(insert, "discount_ledger_month_first", ["2026-12-02", reg, "zakat", "agreed_fee", 4800, "monthly"]);
  await refused(insert, "discount_ledger_amount", ["2026-12-01", reg, "zakat", "agreed_fee", 0, "monthly"]);
  await refused(insert, "discount_ledger_kind", ["2026-12-01", reg, "general", "agreed_fee", 100, "monthly"]);
});

test("a student with ledger history cannot be deleted (accounting record)", async () => {
  const reg = await registration();
  await ok(`INSERT INTO discount_ledger (month, registration_id, kind, reason, amount_cents, source) VALUES ('2026-10-01', $1, 'zakat', 'coupon', 1000, 'wp_import')`, [reg]);
  await refused(`DELETE FROM registrations WHERE id = $1`, "discount_ledger_registration_id_registrations_id_fk", [reg]);
});

/* ── Review reasons ──────────────────────────────────────────────────── */

test("one open reason of a kind; resolved reasons are history and need who resolved them", async () => {
  const reg = await registration();
  const insert = `INSERT INTO review_reasons (registration_id, reason, detail) VALUES ($1, $2, $3)`;
  await ok(insert, [reg, "location", "phone"]);
  await ok(insert, [reg, "location", "ip"]); // another detail is another reason
  await refused(insert, "review_reasons_open_uq", [reg, "location", "phone"]);
  await refused(`UPDATE review_reasons SET resolved_at = now() WHERE registration_id = $1 AND detail = 'phone'`, "review_reasons_resolved_by", [reg]);
  await ok(`UPDATE review_reasons SET resolved_at = now(), resolved_by = 'user_admin' WHERE registration_id = $1 AND detail = 'phone'`, [reg]);
  await ok(insert, [reg, "location", "phone"]); // reopened later: allowed
  await refused(insert, "review_reasons_reason", [reg, "vip", null]);
});

/* ── Idempotency, rate limits, outbox, audit, waitlist ───────────────── */

test("idempotency keys are submit ids, and a finished one keeps its answer", async () => {
  await ok(`INSERT INTO idempotency (key, expires_at) VALUES ('0123456789abcdef', now() + interval '30 minutes')`);
  await refused(`INSERT INTO idempotency (key, expires_at) VALUES ('0123456789abcdef', now())`, "idempotency_pkey");
  await refused(`INSERT INTO idempotency (key, expires_at) VALUES ('short', now())`, "idempotency_key_format");
  await refused(`UPDATE idempotency SET state = 'done' WHERE key = '0123456789abcdef'`, "idempotency_done_has_response");
});

test("rate-limit keys are hashes, never a raw IP or email", async () => {
  await ok(`INSERT INTO rate_limits (key, window_start, count) VALUES ('ip:${"a".repeat(32)}', now(), 1)`);
  await refused(`INSERT INTO rate_limits (key, window_start, count) VALUES ('203.0.113.7', now(), 1)`, "rate_limits_key_hashed");
  await refused(`INSERT INTO rate_limits (key, window_start, count) VALUES ('email:parent@example.com', now(), 1)`, "rate_limits_key_hashed");
});

test("an outbox message is queued once", async () => {
  await ok(`INSERT INTO outbox (kind, dedupe_key, payload) VALUES ('telegram', 'new-registration:9001', '{}')`);
  await refused(`INSERT INTO outbox (kind, dedupe_key, payload) VALUES ('telegram', 'new-registration:9001', '{}')`, "outbox_dedupe_uq");
  await refused(`INSERT INTO outbox (kind, dedupe_key, payload) VALUES ('whatsapp', 'x:1', '{}')`, "outbox_kind");
});

test("a money action in the audit log always has a reason", async () => {
  await ok(`INSERT INTO audit_log (actor, action, entity) VALUES ('user_admin', 'status_change', 'registration')`);
  await refused(`INSERT INTO audit_log (actor, action, entity, amount_cents) VALUES ('user_admin', 'refund', 'payment', 4800)`, "audit_log_money_reason");
  await ok(`INSERT INTO audit_log (actor, action, entity, amount_cents, reason) VALUES ('user_admin', 'refund', 'payment', 4800, 'No class held this month')`);
});

test("the waitlist keeps one entry per email and program, case-insensitive", async () => {
  await ok(`INSERT INTO waitlist (email, program, country) VALUES ('Parent@Example.com', 'monthly', 'PK')`);
  await refused(`INSERT INTO waitlist (email, program) VALUES ('parent@example.com', 'monthly')`, "waitlist_email_program_uq");
  await ok(`INSERT INTO waitlist (email, program) VALUES ('parent@example.com', 'summer')`);
});
