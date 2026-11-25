import { KNOWN_COLUMNS, SOURCE_TABLES, type Row, type Snapshot, type SourceTable } from "../snapshot.ts";

/*
 * A SYNTHETIC snapshot shaped exactly like tooling/wp-export.php's output:
 * every live column of every table (KNOWN_COLUMNS, from SHOW COLUMNS on the
 * live site), values as MySQL returns them (text, NULL as null), and the
 * `checks` block computed the way the export's SQL computes it. Fake people
 * only (zq… names, example.com emails, 555 numbers); the Stripe ids are made up.
 */

/** MySQL column defaults for a row nobody filled in (SHOW COLUMNS, 25 Nov 2026). */
const DEFAULTS: Partial<Record<SourceTable, Row>> = {
  iqu_registrations: {
    form_type: "free", age: "0", wa_updates: "no", payment_amount: "0.00", payment_status: "pending", status: "pending", per_class_rate: "0.00",
    calculated_amount: "0.00", coupon_id: "0", discount_amount: "0.00", zakat_declaration: "0", special_discount: "0", billing_account_id: "0",
    reminders_sent: "0", created_via: "public", existing_student: "0", marketing_consent: "unknown", memorized: null, admin_note: null,
    free_request_reason: null, agreed_fee: null, date_of_birth: null, agreed_fee_fund: null, billing_ended_at: null, archived_at: null,
    archived_by: null, left_at: null, reenrolled_at: null, refunded_amount: null, created_at: "2026-09-01 10:00:00", updated_at: "2026-09-01 10:00:00",
  },
  iqu_billing_accounts: {
    mode: "test", student_type: "current", monthly_amount: "0.00", discount_amount: "0.00", net_amount: "0.00", status: "not_sent", created_by: "0",
    checkout_amount: "0.00", link_outdated: "0", link_reminders: "0", token_hash: null, token_created_at: null, first_charge_date: null, next_charge_at: null,
    last_payment_at: null, email_sent_at: null, whatsapp_sent_at: null, checkout_created_at: null, token_hash_prev: null, ends_at: null,
    link_reminder_base: null, owed_from: null, created_at: "2026-11-01 10:00:00", updated_at: "2026-11-01 10:00:00",
  },
  iqu_billing_members: { mode: "test", amount: "0.00", first_charge_date: null, created_at: "2026-11-01 10:00:00" },
  iqu_billing_payments: {
    mode: "test", amount: "0.00", amount_due: "0.00", amount_paid: "0.00", amount_refunded: "0.00", attempt_count: "0", paid_at: null,
    period_start: null, period_end: null, updated_at: null, receipt_sent_at: null, created_at: "2026-11-01 10:00:00",
  },
  iqu_billing_arrears: { mode: "test", account_id: "0", registration_id: "0", amount: "0.00", status: "owed", user_id: "0", created_at: "2026-11-01 10:00:00", updated_at: "2026-11-01 10:00:00" },
  iqu_billing_actions: { mode: "test", account_id: "0", registration_id: "0", amount: "0.00", user_id: "0", created_at: "2026-11-01 10:00:00" },
  iqu_billing_events: { mode: "test", account_id: null, processed_at: null, result: "received", received_at: "2026-11-20 10:00:00" },
  iqu_coupons: { discount_type: "percentage", discount_value: "0.00", expire_date: null, max_uses: "1", used_count: "0", status: "active", description: null, created_by: "0", created_at: "2026-08-26 10:00:00", updated_at: "2026-08-26 10:00:00" },
  iqu_discount_ledger: { source: "monthly", created_at: "2026-11-01 00:30:00" },
  iqu_waitlist: { created_at: "2026-11-10 10:00:00" },
};

/** A full row: every live column, the MySQL default where the fixture says nothing ('' for NOT NULL text). */
export function row(table: SourceTable, values: Row): Row {
  const out: Row = {};
  for (const c of KNOWN_COLUMNS[table]) out[c] = c in values ? values[c] : c in (DEFAULTS[table] ?? {}) ? DEFAULTS[table]![c] : "";
  return out;
}

const cents = (v: Row[string]) => Math.round(Number(v ?? 0) * 100);

/** The export's `checks` block, computed from the rows as its SQL would. */
export function checksOf(tables: Record<SourceTable, Row[]>): Snapshot["checks"] {
  const sum = (t: SourceTable, col: string) => tables[t].reduce((a, r) => a + cents(r[col]), 0);
  const ledger: Record<string, { rows: number; cents: number }> = {};
  for (const r of tables.iqu_discount_ledger) {
    const k = String(r.kind);
    ledger[k] ??= { rows: 0, cents: 0 };
    ledger[k].rows++;
    ledger[k].cents += cents(r.amount);
  }
  return {
    count: Object.fromEntries(SOURCE_TABLES.map((t) => [t, tables[t].length])),
    max_id: Object.fromEntries(SOURCE_TABLES.map((t) => [t, Math.max(0, ...tables[t].map((r) => Number(r.id)))])),
    ledger,
    payments: {
      amount_paid_cents: sum("iqu_billing_payments", "amount_paid"),
      amount_due_cents: sum("iqu_billing_payments", "amount_due"),
      amount_cents: sum("iqu_billing_payments", "amount"),
      amount_refunded_cents: sum("iqu_billing_payments", "amount_refunded"),
    },
    registrations: {
      payment_amount_cents: sum("iqu_registrations", "payment_amount"),
      discount_amount_cents: sum("iqu_registrations", "discount_amount"),
      agreed_fee_cents: sum("iqu_registrations", "agreed_fee"),
    },
    accounts: { monthly_amount_cents: sum("iqu_billing_accounts", "monthly_amount"), net_amount_cents: sum("iqu_billing_accounts", "net_amount") },
    arrears_cents: sum("iqu_billing_arrears", "amount"),
    coupon_used_count: tables.iqu_coupons.reduce((a, r) => a + Number(r.used_count ?? 0), 0),
  };
}

export function snapshotOf(tables: Record<SourceTable, Row[]>): Snapshot {
  return {
    format: "iqu-wp-snapshot",
    version: 1,
    exported_at: "2027-01-14T15:00:00Z",
    plugin_version: "3.7.20",
    site: "https://example.org/",
    timezone: "Asia/Dhaka",
    datetimes: "UTC",
    excluded: { tables: ["iqu_zeffy_payments"], columns: { iqu_registrations: ["ip_address", "user_agent", "fbp", "fbc"] } },
    tables: Object.fromEntries(SOURCE_TABLES.map((t) => [t, { columns: [...KNOWN_COLUMNS[t]], rows: tables[t] }])),
    checks: checksOf(tables),
  };
}

/** The standard synthetic site: two families (one live with a subscription), eight students, a coupon used twice. */
export function syntheticTables(): Record<SourceTable, Row[]> {
  const reg = (v: Row) => row("iqu_registrations", { last_name: "Zqfamily", ...v });
  return {
    iqu_coupons: [row("iqu_coupons", { id: "7", code: "ALL-260826-Y9GD-100", occasion_name: "Ramadan", course_type: "", discount_value: "100.00", max_uses: "10", used_count: "2" })],
    iqu_billing_accounts: [
      row("iqu_billing_accounts", {
        id: "41", mode: "live", stripe_customer_id: "cus_LiveZq41", stripe_subscription_id: "sub_LiveZq41", guardian_name: "Guard Zqone", contact_email: "family41@example.com",
        contact_whatsapp: "+12145550101", token_hash: "a".repeat(64), status: "active", monthly_amount: "80.00", net_amount: "80.00", first_charge_date: "2026-12-01",
        payment_method_label: "Visa 4242", last_payment_status: "paid", checkout_session_id: "cs_live_ZqSession41", checkout_amount: "80.00",
      }),
      row("iqu_billing_accounts", { id: "42", mode: "test", contact_email: "family42@example.com", status: "link_sent", monthly_amount: "10.00", net_amount: "10.00", email_sent_at: "2026-11-02 09:00:00" }),
    ],
    iqu_registrations: [
      reg({ id: "101", first_name: "Zqa", email: "family41@example.com", status: "enrolled", created_via: "import", existing_student: "1", course_type: "qaidah", days_per_week: "4", calculated_amount: "64.00", payment_amount: "25.00", agreed_fee: "25.00", agreed_fee_fund: "special", country_res: "USA", country_origin: "Bangladesh", whatsapp: "+1 214 555 0101", billing_account_id: "41", languages: "english, bengali", preferred_days: "monday,wednesday", session_dur: "30" }),
      reg({ id: "102", first_name: "Zqb", email: "family41@example.com", status: "enrolled", course_type: "qaidah", days_per_week: "3", calculated_amount: "48.00", discount_amount: "48.00", payment_amount: "0.00", coupon_code: "ALL-260826-Y9GD-100", coupon_id: "7", zakat_declaration: "1", billing_account_id: "41", whatsapp: "+12145550102", country_res: "United States" }),
      reg({ id: "103", first_name: "Zqc", email: "family42@example.com", status: "pending_review", review_reason: "existing_student,sibling", course_type: "hifz", days_per_week: "3", calculated_amount: "60.00", payment_amount: "60.00", country_res: "Dallas tx", whatsapp: "2145550103", billing_account_id: "42" }),
      reg({ id: "104", first_name: "Zqd", email: "summer1@example.com", form_type: "summer_level1", status: "enrolled", enrollment_level: "level1", admission_fee: "flexible", payment_status: "flexible", payment_method: "zelle", payment_amount: "20.00", quran_level: "beginner", time_slot: "9:30 PM (local)", guardian_contact: "+12145550104", country_res: "Canada" }),
      reg({ id: "105", first_name: "Zqe", email: "summer2@example.com", form_type: "summer_level2", status: "enrolled", admission_fee: "complimentary", payment_status: "complimentary", coupon_id: "7", zakat_declaration: "1", whatsapp: "+1 (214) 555-0105" }),
      reg({ id: "106", first_name: "Zqf", email: "weekend@example.com", form_type: "weekend_existing", status: "cancelled", enrollment_level: "weekend", admission_fee: "free", payment_status: "not_required" }),
      reg({ id: "107", first_name: "Zqg", email: "uk@example.com", status: "enrolled", created_via: "admin", special_discount: "1", course_type: "qaidah", days_per_week: "4", calculated_amount: "64.00", discount_amount: "16.00", payment_amount: "48.00", pay_session_id: "cs_live_ZqPay107", whatsapp: "+44 20 7946 0958", country_res: "Babgladesh", guardian_contact: "+8801711000000", device: "smartphone", referral: "facebook" }),
      reg({ id: "108", first_name: "Zqh", email: "scholar@example.com", status: "enrolled", created_via: "import", existing_student: "1", course_type: "qaidah", days_per_week: "5", calculated_amount: "80.00", payment_amount: "0.00", agreed_fee: "0.00", agreed_fee_fund: "zakat", archived_at: "2026-11-20 10:00:00", archived_by: "3", whatsapp: "+999" }),
    ],
    iqu_billing_members: [
      row("iqu_billing_members", { id: "1", account_id: "41", registration_id: "101", mode: "live", amount: "25.00", stripe_item_id: "si_LiveZq1", first_charge_date: "2026-12-01" }),
      row("iqu_billing_members", { id: "2", account_id: "41", registration_id: "102", mode: "live", amount: "0.00" }),
      row("iqu_billing_members", { id: "3", account_id: "42", registration_id: "103", mode: "test", amount: "10.00" }),
    ],
    iqu_billing_payments: [
      row("iqu_billing_payments", { id: "1", stripe_invoice_id: "in_LiveZq1", account_id: "41", mode: "live", status: "paid", amount: "80.00", amount_due: "80.00", amount_paid: "80.00", period_month: "2026-12", paid_at: "2026-12-01 06:00:00", hosted_invoice_url: "https://invoice.stripe.com/i/acct_1/zq1", receipt_number: "1234-5678" }),
      row("iqu_billing_payments", { id: "2", stripe_invoice_id: "in_LiveZq2", account_id: "41", mode: "live", status: "", amount: "40.00", amount_due: "40.00", amount_paid: "0.00", paid_at: "2026-11-01 06:00:00" }),
      row("iqu_billing_payments", { id: "3", stripe_invoice_id: "in_TestZq3", account_id: "42", mode: "test", status: "open", amount_due: "10.00" }),
    ],
    iqu_billing_arrears: [
      row("iqu_billing_arrears", { id: "1", mode: "live", account_id: "41", registration_id: "101", month: "2026-11-01", amount: "25.00", source: "missed", status: "due", old_invoice_id: "in_LiveOld1" }),
      row("iqu_billing_arrears", { id: "2", mode: "live", account_id: "41", registration_id: "102", month: "2026-10-01", amount: "48.00", status: "waived", reason: "Family hardship", user_id: "3" }),
      row("iqu_billing_arrears", { id: "3", mode: "test", account_id: "42", month: "2026-09-01", amount: "10.00", status: "team" }),
    ],
    iqu_billing_events: [
      row("iqu_billing_events", { id: "1", stripe_event_id: "evt_LiveZq1", mode: "live", type: "invoice.paid", result: "no_account", processed_at: "2026-11-20 10:00:01" }),
      row("iqu_billing_events", { id: "2", stripe_event_id: "evt_TestZq2", mode: "test", type: "checkout.session.completed", account_id: "42", result: "ok", processed_at: "2026-11-20 10:00:02", note: "enrolled" }),
      row("iqu_billing_events", { id: "3", stripe_event_id: "evt_LiveZq3", mode: "live", type: "invoice.paid", result: "received" }),
    ],
    iqu_discount_ledger: [
      row("iqu_discount_ledger", { id: "1", month: "2026-10-01", registration_id: "101", kind: "special", reason: "agreed_fee", amount: "39.00" }),
      row("iqu_discount_ledger", { id: "2", month: "2026-11-01", registration_id: "101", kind: "special", reason: "agreed_fee", amount: "39.00" }),
      row("iqu_discount_ledger", { id: "3", month: "2026-11-01", registration_id: "102", kind: "zakat", reason: "coupon", amount: "48.00" }),
      row("iqu_discount_ledger", { id: "4", month: "2026-11-01", registration_id: "107", kind: "special", reason: "special_plan", amount: "16.00" }),
      row("iqu_discount_ledger", { id: "5", month: "2026-11-01", registration_id: "108", kind: "zakat", reason: "agreed_fee", amount: "80.00" }),
    ],
    iqu_waitlist: [row("iqu_waitlist", { id: "1", email: "Waiting@Example.com", name: "Zq Waiting", country: "GB", program: "free", source: "modal" })],
    iqu_billing_actions: [
      row("iqu_billing_actions", { id: "1", mode: "live", action: "site_mode", reason: "live", user_id: "3" }),
      row("iqu_billing_actions", { id: "2", mode: "live", account_id: "41", registration_id: "101", action: "left", user_id: "3" }),
      row("iqu_billing_actions", { id: "3", mode: "live", account_id: "41", registration_id: "102", action: "remove_student", amount: "25.00", stripe_ref: "si_LiveZq9", user_id: "3" }),
    ],
  };
}
