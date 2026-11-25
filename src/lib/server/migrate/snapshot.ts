import { z } from "zod";

/*
 * The snapshot that tooling/wp-export.php returns (format "iqu-wp-snapshot",
 * version 1). KNOWN_COLUMNS is the live column list of each table (SHOW
 * COLUMNS on the live site, plugin 3.7.20, 25 Nov 2026) minus what the export
 * leaves out. A snapshot with a missing OR an unknown column is refused: a
 * plugin update that adds a column must be mapped before it can be imported.
 */

export const SOURCE_TABLES = [
  "iqu_coupons",
  "iqu_billing_accounts",
  "iqu_registrations",
  "iqu_billing_members",
  "iqu_billing_payments",
  "iqu_billing_arrears",
  "iqu_billing_events",
  "iqu_discount_ledger",
  "iqu_waitlist",
  "iqu_billing_actions",
] as const;
export type SourceTable = (typeof SOURCE_TABLES)[number];

/** Left out by the export (never copied): owner decision 1 and P1 decision 4. */
export const EXCLUDED_COLUMNS: Partial<Record<SourceTable, readonly string[]>> = {
  iqu_registrations: ["ip_address", "user_agent", "fbp", "fbc"],
};

export const KNOWN_COLUMNS: Record<SourceTable, readonly string[]> = {
  iqu_registrations: [
    "id", "form_type", "first_name", "last_name", "email", "age", "country_origin", "country_res", "quran_level", "days_per_week",
    "preferred_days", "time_slot", "session_dur", "languages", "whatsapp", "memorized", "teacher_pref", "device", "referral", "wa_updates",
    "fee_pref", "enrollment_level", "guardian_name", "guardian_contact", "guardian_whatsapp", "whatsapp_group", "future_updates",
    "admission_fee", "payment_method", "payment_amount", "transaction_id", "payment_status", "status", "admin_note", "created_at",
    "updated_at", "free_request_reason", "referral_other", "flexible_fee_note", "course_type", "per_class_rate", "calculated_amount",
    "coupon_code", "coupon_id", "discount_amount", "zakat_declaration", "special_discount", "review_reason", "country_ip", "pay_session_id",
    "billing_account_id", "reminders_sent", "created_via", "existing_student", "agreed_fee", "marketing_consent", "date_of_birth",
    "agreed_fee_fund", "billing_ended_at", "archived_at", "archived_by", "left_at", "reenrolled_at", "refunded_amount",
  ],
  iqu_billing_accounts: [
    "id", "mode", "stripe_customer_id", "stripe_subscription_id", "guardian_name", "contact_email", "contact_whatsapp", "token_hash",
    "token_created_at", "student_type", "monthly_amount", "discount_amount", "net_amount", "first_charge_date", "next_charge_at", "status",
    "payment_method_label", "last_payment_status", "last_payment_at", "last_failure_reason", "email_sent_at", "whatsapp_sent_at",
    "created_by", "created_at", "updated_at", "checkout_session_id", "checkout_amount", "checkout_created_at", "link_outdated",
    "review_reason", "review_note", "token_hash_prev", "ends_at", "link_reminder_base", "link_reminders", "owed_from",
  ],
  iqu_billing_members: ["id", "account_id", "registration_id", "mode", "amount", "stripe_item_id", "created_at", "first_charge_date"],
  iqu_billing_payments: [
    "id", "stripe_invoice_id", "account_id", "mode", "amount", "paid_at", "created_at", "status", "period_month", "period_start",
    "period_end", "amount_due", "amount_paid", "amount_refunded", "method_label", "hosted_invoice_url", "invoice_pdf", "receipt_number",
    "attempt_count", "failure_reason", "updated_at", "receipt_sent_at",
  ],
  iqu_billing_arrears: [
    "id", "mode", "account_id", "registration_id", "month", "amount", "source", "old_invoice_id", "item_id", "charged_invoice_id",
    "status", "reason", "user_id", "created_at", "updated_at",
  ],
  iqu_billing_actions: ["id", "mode", "account_id", "registration_id", "action", "amount", "reason", "stripe_ref", "user_id", "created_at"],
  iqu_billing_events: ["id", "stripe_event_id", "mode", "type", "account_id", "received_at", "processed_at", "result", "note"],
  iqu_coupons: [
    "id", "code", "occasion_name", "course_type", "discount_type", "discount_value", "expire_date", "max_uses", "used_count", "status",
    "description", "created_by", "created_at", "updated_at",
  ],
  iqu_discount_ledger: ["id", "month", "registration_id", "kind", "reason", "amount", "source", "created_at"],
  iqu_waitlist: ["id", "email", "name", "country", "program", "source", "created_at"],
};

const cell = z.union([z.string(), z.number(), z.null()]);
const table = z.object({ columns: z.array(z.string()), rows: z.array(z.record(z.string(), cell)) });
const cents = z.number().int();

export const snapshotSchema = z.object({
  format: z.literal("iqu-wp-snapshot"),
  version: z.literal(1),
  exported_at: z.string(),
  plugin_version: z.string(),
  site: z.string(),
  timezone: z.string(),
  datetimes: z.literal("UTC"),
  excluded: z.unknown().optional(),
  tables: z.record(z.string(), table),
  checks: z.object({
    count: z.record(z.string(), z.number().int()),
    max_id: z.record(z.string(), z.number().int()),
    ledger: z.record(z.string(), z.object({ rows: z.number().int(), cents })).optional().default({}),
    payments: z.object({ amount_paid_cents: cents, amount_due_cents: cents, amount_cents: cents, amount_refunded_cents: cents }),
    registrations: z.object({ payment_amount_cents: cents, discount_amount_cents: cents, agreed_fee_cents: cents }),
    accounts: z.object({ monthly_amount_cents: cents, net_amount_cents: cents }),
    arrears_cents: cents,
    coupon_used_count: z.number().int(),
  }),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type Row = Record<string, string | number | null>;

/** Format, tables and columns: the problems that stop an import before anything is read. */
export function checkShape(snap: Snapshot): string[] {
  const problems: string[] = [];
  for (const t of SOURCE_TABLES) {
    const got = snap.tables[t];
    if (!got) {
      problems.push(`${t}: missing from the snapshot.`);
      continue;
    }
    const want = new Set(KNOWN_COLUMNS[t]);
    const have = new Set(got.columns);
    const missing = [...want].filter((c) => !have.has(c));
    const unknown = [...have].filter((c) => !want.has(c));
    if (missing.length) problems.push(`${t}: columns missing: ${missing.join(", ")}.`);
    if (unknown.length) problems.push(`${t}: columns not mapped yet: ${unknown.join(", ")}.`);
    const excluded = (EXCLUDED_COLUMNS[t] ?? []).filter((c) => have.has(c));
    if (excluded.length) problems.push(`${t}: the snapshot contains ${excluded.join(", ")}, which must never be copied. Re-export with tooling/wp-export.php.`);
    if (snap.checks.count[t] !== got.rows.length) problems.push(`${t}: ${got.rows.length} rows in the snapshot but MySQL counted ${snap.checks.count[t]}.`);
  }
  for (const t of Object.keys(snap.tables)) {
    if (!(SOURCE_TABLES as readonly string[]).includes(t)) problems.push(`${t}: not an enrollment table (the Zeffy table stays on WordPress).`);
  }
  return problems;
}
