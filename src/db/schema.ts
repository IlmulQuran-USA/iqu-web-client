import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  char,
} from "drizzle-orm/pg-core";

/*
 * The enrollment and billing database (P0). Architecture:
 * F:/iqu-setup/reports/enroll-next-native-architecture.md §1.2 and its
 * "Resolved facts" (owner, 24 Nov 2026).
 *
 * The live iqu-registration plugin is the specification: every column of
 * its 11 bvgc_iqu_* tables has a home here, plus the structured fields of
 * N1–N19. House rules, enforced by constraints and covered by
 * src/db/schema.test.ts:
 *
 * - Money is integer cents (never a float), and never negative.
 * - Every row that points at Stripe carries `mode` ('test' | 'live'), so test
 *   and live data never mix (plugin rule, PLUGIN-INVENTORY §4.1).
 * - No IP address column, anywhere (owner decision 1). Only a 2-letter
 *   country and, in rate limits, an HMAC key.
 * - Registration and family ids are kept from WordPress on import, so the
 *   IQU number and the plugin's Stripe metadata (iqu_account_id) still match;
 *   new rows continue above them (identity "by default").
 * - Times are timestamptz (UTC); calendar dates are `date`.
 * - Enumerations are text + CHECK, so a new value is one migration, not an
 *   enum rebuild.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const created = () => ts("created_at").notNull().defaultNow();
const updated = () => ts("updated_at").notNull().defaultNow();
const id = () => bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const ref = (name: string) => bigint(name, { mode: "number" });
const cents = (name: string) => integer(name);

/** `col IN ('a','b',…)` for a CHECK. Values are code constants, never user input. */
function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`${column} IN (${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`);
}
function optionalOneOf(column: string, values: readonly string[]) {
  return sql.raw(`${column} IS NULL OR ${column} IN (${values.map((v) => `'${v}'`).join(", ")})`);
}

/* ── Value lists (shared with the app) ───────────────────────────────── */

export const MODES = ["test", "live"] as const;
export const PROGRAMS = ["monthly", "summer_l1", "summer_l2", "weekend_new", "weekend_existing"] as const;
export const REGISTRATION_STATUSES = [
  "pending",
  "card_pending",
  "pending_review",
  "enrolled",
  "paid",
  "contacted",
  "confirmed",
  "cancelled",
  "expired",
] as const;
export const CREATED_VIA = ["public", "admin", "import"] as const;
export const REVIEW_REASONS = [
  "location",
  "help",
  "aid_request",
  "existing_student",
  "existing_unknown",
  "sibling",
  "payment_setup",
  "card_country",
  "amount",
  "coupon_used_up",
] as const;
export const FAMILY_STATUSES = [
  "not_sent",
  "link_sent",
  "free_month",
  "waiting_first_charge",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "canceled",
  "review",
  "bank_verification",
  "ending",
] as const;
export const FUNDS = ["zakat", "special"] as const;
export const LEDGER_REASONS = ["coupon", "special_plan", "agreed_fee", "admin_discount"] as const;
export const LEDGER_SOURCES = ["monthly", "backfill", "wp_import"] as const;
export const STRIPE_EVENT_RESULTS = ["processing", "processed", "ignored_other_mode", "not_iqu", "duplicate", "error"] as const;
export const OUTBOX_KINDS = ["telegram", "email", "meta"] as const;
/** skipped = refused by a staging guard (an address not on EMAIL_ALLOWLIST, a chat other than the test chat): logged, never sent. */
export const OUTBOX_STATUSES = ["pending", "sent", "skipped", "failed", "dead"] as const;
/** Quran levels: the four of owner decision 6, plus the plugin's old three (imported rows). */
export const QURAN_LEVELS = ["no_letters", "qaidah", "quran", "memorizing", "beginner", "intermediate", "advanced"] as const;
/** Class lengths: the live list, plus 45 and 'other' kept readable on imported rows (plugin 3.7.13). */
export const SESSION_MINUTES = [30, 40, 45, 50, 60] as const;

/* ── coupons ─────────────────────────────────────────────────────────── */

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull(),
    occasion: text("occasion"),
    /** A pricing key (qaidah, hifz, arabic, tarjumatul_quran, islamic_studies) or ALL. */
    courseKey: text("course_key").notNull(),
    discountType: text("discount_type").notNull(),
    valuePercent: smallint("value_percent"),
    valueCents: cents("value_cents"),
    expiresOn: date("expires_on", { mode: "string" }),
    maxUses: integer("max_uses"),
    status: text("status").notNull().default("active"),
    description: text("description"),
    createdBy: text("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("coupons_code_uq").on(t.code),
    check("coupons_code_format", sql`${t.code} ~ '^[A-Z0-9-]{4,40}$'`),
    check("coupons_discount_type", oneOf("discount_type", ["percent", "fixed"])),
    check(
      "coupons_value_matches_type",
      sql`(${t.discountType} = 'percent' AND ${t.valuePercent} BETWEEN 1 AND 100 AND ${t.valueCents} IS NULL)
       OR (${t.discountType} = 'fixed' AND ${t.valueCents} > 0 AND ${t.valuePercent} IS NULL)`,
    ),
    check("coupons_status", oneOf("status", ["active", "inactive"])),
    check("coupons_max_uses", sql`${t.maxUses} IS NULL OR ${t.maxUses} >= 1`),
  ],
);

/* ── families (one billing account = one Stripe customer + subscription) ── */

export const families = pgTable(
  "families",
  {
    /** Kept from iqu_billing_accounts.id on import: the plugin's Stripe metadata iqu_account_id. */
    id: id(),
    mode: text("mode").notNull(),
    source: text("source").notNull().default("next"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    guardianName: text("guardian_name"),
    contactEmail: text("contact_email").notNull(),
    contactWhatsapp: text("contact_whatsapp"),
    /** SHA-256 of the signed billing link token; the token itself is never stored. */
    linkTokenHash: char("link_token_hash", { length: 64 }),
    linkTokenHashPrev: char("link_token_hash_prev", { length: 64 }),
    tokenCreatedAt: ts("token_created_at"),
    studentType: text("student_type").notNull(),
    monthlyCents: cents("monthly_cents").notNull().default(0),
    discountCents: cents("discount_cents").notNull().default(0),
    netCents: cents("net_cents").notNull().default(0),
    firstChargeDate: date("first_charge_date", { mode: "string" }),
    nextChargeAt: ts("next_charge_at"),
    status: text("status").notNull().default("not_sent"),
    paymentMethodLabel: text("payment_method_label"),
    lastPaymentStatus: text("last_payment_status"),
    lastPaymentAt: ts("last_payment_at"),
    lastFailureReason: text("last_failure_reason"),
    emailSentAt: ts("email_sent_at"),
    whatsappSentAt: ts("whatsapp_sent_at"),
    checkoutSessionId: text("checkout_session_id"),
    checkoutCents: cents("checkout_cents"),
    checkoutCreatedAt: ts("checkout_created_at"),
    linkOutdated: boolean("link_outdated").notNull().default(false),
    reviewReason: text("review_reason"),
    reviewNote: text("review_note"),
    endsAt: ts("ends_at"),
    owedFrom: date("owed_from", { mode: "string" }),
    linkReminderBase: ts("link_reminder_base"),
    linkReminders: smallint("link_reminders").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    check("families_mode", oneOf("mode", MODES)),
    check("families_source", oneOf("source", ["next", "wp_import"])),
    check("families_student_type", oneOf("student_type", ["new", "current"])),
    check("families_status", oneOf("status", FAMILY_STATUSES)),
    check("families_money", sql`${t.monthlyCents} >= 0 AND ${t.discountCents} >= 0 AND ${t.netCents} >= 0`),
    check("families_net", sql`${t.netCents} = ${t.monthlyCents} - ${t.discountCents}`),
    check("families_checkout_cents", sql`${t.checkoutCents} IS NULL OR ${t.checkoutCents} >= 0`),
    check("families_customer_id", sql`${t.stripeCustomerId} IS NULL OR ${t.stripeCustomerId} ~ '^cus_[A-Za-z0-9]+$'`),
    check("families_subscription_id", sql`${t.stripeSubscriptionId} IS NULL OR ${t.stripeSubscriptionId} ~ '^sub_[A-Za-z0-9]+$'`),
    uniqueIndex("families_customer_uq").on(t.mode, t.stripeCustomerId).where(sql`${t.stripeCustomerId} IS NOT NULL`),
    uniqueIndex("families_subscription_uq").on(t.mode, t.stripeSubscriptionId).where(sql`${t.stripeSubscriptionId} IS NOT NULL`),
    uniqueIndex("families_token_uq").on(t.linkTokenHash).where(sql`${t.linkTokenHash} IS NOT NULL`),
    index("families_email_idx").on(sql`lower(${t.contactEmail})`, t.mode),
    index("families_status_idx").on(t.mode, t.status),
  ],
);

/* ── registrations (one enrollment: a student in a program) ───────────── */

export const registrations = pgTable(
  "registrations",
  {
    /** The IQU number (IQU-<id>). Kept from WordPress on import. */
    id: id(),
    program: text("program").notNull(),
    status: text("status").notNull().default("pending"),
    createdVia: text("created_via").notNull().default("public"),
    // Student and family
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    ageAtSignup: smallint("age_at_signup"),
    guardianName: text("guardian_name"),
    email: text("email").notNull(),
    whatsappE164: text("whatsapp_e164"),
    guardianContactE164: text("guardian_contact_e164"),
    guardianWhatsappE164: text("guardian_whatsapp_e164"),
    countryResCode: char("country_res_code", { length: 2 }),
    countryResName: text("country_res_name"),
    countryOriginCode: char("country_origin_code", { length: 2 }),
    countryOriginName: text("country_origin_name"),
    /** 2-letter country of the request (from Vercel). Never an IP address (decision 1). */
    countryIp: char("country_ip", { length: 2 }),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    languagesOther: text("languages_other"),
    existingStudent: boolean("existing_student"),
    // Course and schedule
    quranLevel: text("quran_level"),
    memorized: text("memorized"),
    teacherPref: text("teacher_pref"),
    courseKey: text("course_key"),
    courseVariant: text("course_variant"),
    daysPerWeek: smallint("days_per_week"),
    preferredDays: text("preferred_days").array().notNull().default(sql`'{}'::text[]`),
    sessionMinutes: smallint("session_minutes"),
    timeStart: time("time_start"),
    timeEnd: time("time_end"),
    timeZone: text("time_zone"),
    timeZoneLabel: text("time_zone_label"),
    timeSlotText: text("time_slot_text"),
    // Fees
    perClassCents: cents("per_class_cents"),
    calculatedCents: cents("calculated_cents"),
    discountCents: cents("discount_cents").notNull().default(0),
    paymentCents: cents("payment_cents"),
    specialPlan: boolean("special_plan").notNull().default(false),
    couponId: ref("coupon_id").references(() => coupons.id, { onDelete: "restrict" }),
    zakatDeclaration: boolean("zakat_declaration").notNull().default(false),
    zakatDeclarationText: text("zakat_declaration_text"),
    declaredAt: ts("declared_at"),
    aidLevel: text("aid_level"),
    aidNote: text("aid_note"),
    agreedFeeCents: cents("agreed_fee_cents"),
    agreedFeeFund: text("agreed_fee_fund"),
    // Summer
    admissionFee: text("admission_fee"),
    flexibleFeeNote: text("flexible_fee_note"),
    paymentStatus: text("payment_status"),
    paymentMethod: text("payment_method"),
    transactionId: text("transaction_id"),
    stripeMode: text("stripe_mode"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    checkoutSessionId: text("checkout_session_id"),
    // Billing link
    familyId: ref("family_id").references(() => families.id, { onDelete: "restrict" }),
    // Review step answers and consents
    referral: text("referral"),
    referralOther: text("referral_other"),
    waUpdates: boolean("wa_updates"),
    futureUpdates: boolean("future_updates"),
    whatsappGroup: text("whatsapp_group"),
    termsAcceptedAt: ts("terms_accepted_at"),
    timingConsentAt: ts("timing_consent_at"),
    marketingConsent: text("marketing_consent").notNull().default("unknown"),
    fbp: text("fbp"),
    fbc: text("fbc"),
    userAgent: text("user_agent"),
    // Lifecycle
    submitId: text("submit_id"),
    remindersSent: smallint("reminders_sent").notNull().default(0),
    adminNote: text("admin_note"),
    leftAt: ts("left_at"),
    billingEndedAt: ts("billing_ended_at"),
    reenrolledAt: ts("reenrolled_at"),
    archivedAt: ts("archived_at"),
    archivedBy: text("archived_by"),
    refundedCents: cents("refunded_cents").notNull().default(0),
    // Legacy plugin fields, kept readable on imported rows only
    legacyFeePref: text("legacy_fee_pref"),
    legacyFreeRequestReason: text("legacy_free_request_reason"),
    legacyDevice: text("legacy_device"),
    legacyEnrollmentLevel: text("legacy_enrollment_level"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    check("registrations_program", oneOf("program", PROGRAMS)),
    check("registrations_status", oneOf("status", REGISTRATION_STATUSES)),
    check("registrations_created_via", oneOf("created_via", CREATED_VIA)),
    check("registrations_quran_level", optionalOneOf("quran_level", QURAN_LEVELS)),
    check("registrations_teacher_pref", optionalOneOf("teacher_pref", ["male", "female", "no_preference"])),
    check("registrations_days", sql`${t.daysPerWeek} IS NULL OR ${t.daysPerWeek} BETWEEN 1 AND 7`),
    check("registrations_session_minutes", sql.raw(`session_minutes IS NULL OR session_minutes IN (${SESSION_MINUTES.join(", ")})`)),
    check("registrations_window", sql`${t.timeStart} IS NULL OR ${t.timeEnd} IS NULL OR ${t.timeEnd} > ${t.timeStart}`),
    check("registrations_aid_level", optionalOneOf("aid_level", ["30", "45", "50", "full"])),
    check("registrations_agreed_fund", optionalOneOf("agreed_fee_fund", FUNDS)),
    check("registrations_whatsapp_group", optionalOneOf("whatsapp_group", ["yes", "no", "maybe"])),
    check("registrations_marketing_consent", oneOf("marketing_consent", ["granted", "denied", "unknown"])),
    check("registrations_stripe_mode", optionalOneOf("stripe_mode", MODES)),
    check(
      "registrations_admission_fee",
      optionalOneOf("admission_fee", ["standard", "supported", "complimentary", "flexible", "free", "50", "30"]),
    ),
    check(
      "registrations_money",
      sql`${t.discountCents} >= 0 AND ${t.refundedCents} >= 0
       AND (${t.perClassCents} IS NULL OR ${t.perClassCents} >= 0)
       AND (${t.calculatedCents} IS NULL OR ${t.calculatedCents} >= 0)
       AND (${t.paymentCents} IS NULL OR ${t.paymentCents} >= 0)
       AND (${t.agreedFeeCents} IS NULL OR ${t.agreedFeeCents} >= 0)`,
    ),
    // No check ties agreed_fee_fund to agreed_fee_cents: the fund also says where an ADMIN DISCOUNT
    // counts (a reduction with no coupon, no special plan and no agreed fee; discount-ledger.php:42-43,
    // 143-144). Migration 0002 drops the P0 check that refused it. "Agreed fee ticked with no amount"
    // is refused by the admin form (P3), not here.
    // A coupon is always backed by a Zakat declaration (plugin rule).
    check("registrations_coupon_declared", sql`${t.couponId} IS NULL OR ${t.zakatDeclaration}`),
    // Special plan and coupon never combine (plugin rule).
    check("registrations_special_xor_coupon", sql`NOT (${t.specialPlan} AND ${t.couponId} IS NOT NULL)`),
    check("registrations_country_codes", sql`(${t.countryResCode} IS NULL OR ${t.countryResCode} ~ '^[A-Z]{2}$')
       AND (${t.countryOriginCode} IS NULL OR ${t.countryOriginCode} ~ '^[A-Z]{2}$')
       AND (${t.countryIp} IS NULL OR ${t.countryIp} ~ '^[A-Z]{2}$')`),
    check("registrations_e164", sql`(${t.whatsappE164} IS NULL OR ${t.whatsappE164} ~ '^\\+[1-9][0-9]{6,14}$')
       AND (${t.guardianContactE164} IS NULL OR ${t.guardianContactE164} ~ '^\\+[1-9][0-9]{6,14}$')
       AND (${t.guardianWhatsappE164} IS NULL OR ${t.guardianWhatsappE164} ~ '^\\+[1-9][0-9]{6,14}$')`),
    uniqueIndex("registrations_submit_id_uq").on(t.submitId).where(sql`${t.submitId} IS NOT NULL`),
    index("registrations_email_idx").on(sql`lower(${t.email})`),
    index("registrations_status_idx").on(t.program, t.status),
    index("registrations_family_idx").on(t.familyId),
  ],
);

/* ── review_reasons (N7: open and resolved reasons, with detail) ──────── */

export const reviewReasons = pgTable(
  "review_reasons",
  {
    id: id(),
    registrationId: ref("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    /** e.g. location: phone | ip | residence | residence_unknown. */
    detail: text("detail"),
    openedAt: ts("opened_at").notNull().defaultNow(),
    resolvedAt: ts("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    check("review_reasons_reason", oneOf("reason", REVIEW_REASONS)),
    check("review_reasons_resolved_by", sql`${t.resolvedAt} IS NULL OR ${t.resolvedBy} IS NOT NULL`),
    // One open reason of a kind per enrollment; resolved ones are history.
    uniqueIndex("review_reasons_open_uq")
      .on(t.registrationId, t.reason, sql`coalesce(${t.detail}, '')`)
      .where(sql`${t.resolvedAt} IS NULL`),
  ],
);

/* ── family_members (enrollment ↔ family) ────────────────────────────── */

export const familyMembers = pgTable(
  "family_members",
  {
    id: id(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "restrict" }),
    registrationId: ref("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "restrict" }),
    mode: text("mode").notNull(),
    amountCents: cents("amount_cents").notNull(),
    stripeItemId: text("stripe_item_id"),
    firstChargeDate: date("first_charge_date", { mode: "string" }),
    /** A sibling first billed later: the hourly job adds the line just before that billing day. */
    deferred: boolean("deferred").notNull().default(false),
    createdAt: created(),
  },
  (t) => [
    check("family_members_mode", oneOf("mode", MODES)),
    check("family_members_amount", sql`${t.amountCents} >= 0`),
    uniqueIndex("family_members_registration_uq").on(t.mode, t.registrationId),
  ],
);

/* ── payments (one row per Stripe invoice) ───────────────────────────── */

export const payments = pgTable(
  "payments",
  {
    id: id(),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "restrict" }),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    periodMonth: char("period_month", { length: 7 }),
    periodStart: ts("period_start"),
    periodEnd: ts("period_end"),
    amountDueCents: cents("amount_due_cents").notNull().default(0),
    amountPaidCents: cents("amount_paid_cents").notNull().default(0),
    amountRefundedCents: cents("amount_refunded_cents").notNull().default(0),
    methodLabel: text("method_label"),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdf: text("invoice_pdf"),
    receiptNumber: text("receipt_number"),
    attemptCount: smallint("attempt_count").notNull().default(0),
    failureReason: text("failure_reason"),
    paidAt: ts("paid_at"),
    /** Atomic claim before the IQU receipt email, so it is never sent twice. */
    receiptClaimedAt: ts("receipt_claimed_at"),
    receiptSentAt: ts("receipt_sent_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("payments_invoice_uq").on(t.stripeInvoiceId),
    check("payments_mode", oneOf("mode", MODES)),
    check("payments_invoice_id", sql`${t.stripeInvoiceId} ~ '^in_[A-Za-z0-9]+$'`),
    check(
      "payments_money",
      sql`${t.amountDueCents} >= 0 AND ${t.amountPaidCents} >= 0 AND ${t.amountRefundedCents} >= 0 AND ${t.amountRefundedCents} <= ${t.amountPaidCents}`,
    ),
    check("payments_period_month", sql`${t.periodMonth} IS NULL OR ${t.periodMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    // Receipt and invoice links are kept only when they point at Stripe (plugin rule).
    check(
      "payments_stripe_links",
      sql`(${t.hostedInvoiceUrl} IS NULL OR ${t.hostedInvoiceUrl} ~ '^https://([a-z0-9-]+\\.)*stripe\\.com/')
       AND (${t.invoicePdf} IS NULL OR ${t.invoicePdf} ~ '^https://([a-z0-9-]+\\.)*stripe\\.com/')`,
    ),
    index("payments_family_idx").on(t.familyId, t.periodMonth),
  ],
);

/* ── arrears (an earlier month owed) ─────────────────────────────────── */

export const arrears = pgTable(
  "arrears",
  {
    id: id(),
    mode: text("mode").notNull(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "restrict" }),
    registrationId: ref("registration_id").references(() => registrations.id, { onDelete: "restrict" }),
    month: date("month", { mode: "string" }).notNull(),
    amountCents: cents("amount_cents").notNull(),
    source: text("source"),
    oldInvoiceId: text("old_invoice_id"),
    itemId: text("item_id"),
    chargedInvoiceId: text("charged_invoice_id"),
    status: text("status").notNull().default("open"),
    reason: text("reason"),
    userId: text("user_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    check("arrears_mode", oneOf("mode", MODES)),
    check("arrears_status", oneOf("status", ["open", "scheduled", "charged", "waived", "escalated"])),
    check("arrears_amount", sql`${t.amountCents} > 0`),
    check("arrears_month_first", sql`extract(day from ${t.month}) = 1`),
    // Waiving needs a reason (plugin rule: named refund admins, reason required).
    check("arrears_waive_reason", sql`${t.status} <> 'waived' OR (${t.reason} IS NOT NULL AND length(${t.reason}) > 0)`),
    uniqueIndex("arrears_month_uq").on(t.familyId, sql`coalesce(${t.registrationId}, 0)`, t.month),
  ],
);

/* ── stripe_events (dedupe + audit; no payloads) ─────────────────────── */

export const stripeEvents = pgTable(
  "stripe_events",
  {
    stripeEventId: text("stripe_event_id").primaryKey(),
    mode: text("mode").notNull(),
    type: text("type").notNull(),
    familyId: ref("family_id"),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    result: text("result").notNull().default("processing"),
    note: text("note"),
  },
  (t) => [
    check("stripe_events_mode", oneOf("mode", MODES)),
    check("stripe_events_result", oneOf("result", STRIPE_EVENT_RESULTS)),
    check("stripe_events_id", sql`${t.stripeEventId} ~ '^evt_[A-Za-z0-9]+$'`),
  ],
);

/* ── audit_log (every admin and money action) ────────────────────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    /** Clerk user id, or 'system:<job>' for scheduled work. */
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    /** Both kept (as in iqu_billing_actions), so imported history loses neither. */
    familyId: ref("family_id"),
    registrationId: ref("registration_id"),
    mode: text("mode"),
    amountCents: cents("amount_cents"),
    reason: text("reason"),
    stripeRef: text("stripe_ref"),
    before: jsonb("before"),
    after: jsonb("after"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [
    check("audit_log_mode", optionalOneOf("mode", MODES)),
    // A money action always carries a reason (plugin rule for refund, stop, waive…).
    check("audit_log_money_reason", sql`${t.amountCents} IS NULL OR (${t.reason} IS NOT NULL AND length(${t.reason}) > 0)`),
    index("audit_log_entity_idx").on(t.entity, t.entityId),
  ],
);

/* ── coupon_redemptions (exact usage) ────────────────────────────────── */

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    couponId: ref("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "restrict" }),
    registrationId: ref("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "restrict" }),
    redeemedAt: ts("redeemed_at").notNull().defaultNow(),
    releasedAt: ts("released_at"),
  },
  (t) => [primaryKey({ columns: [t.couponId, t.registrationId] })],
);

/* ── discount_ledger (Zakat / Special accounting; never recalculated) ─── */

export const discountLedger = pgTable(
  "discount_ledger",
  {
    id: id(),
    month: date("month", { mode: "string" }).notNull(),
    registrationId: ref("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    amountCents: cents("amount_cents").notNull(),
    source: text("source").notNull(),
    createdAt: created(),
  },
  (t) => [
    check("discount_ledger_kind", oneOf("kind", FUNDS)),
    check("discount_ledger_reason", oneOf("reason", LEDGER_REASONS)),
    check("discount_ledger_source", oneOf("source", LEDGER_SOURCES)),
    check("discount_ledger_amount", sql`${t.amountCents} > 0`),
    check("discount_ledger_month_first", sql`extract(day from ${t.month}) = 1`),
    uniqueIndex("discount_ledger_month_uq").on(t.month, t.registrationId, t.kind),
    index("discount_ledger_kind_idx").on(t.kind, t.month),
  ],
);

/* ── waitlist ────────────────────────────────────────────────────────── */

export const waitlist = pgTable(
  "waitlist",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    country: char("country", { length: 2 }),
    program: text("program").notNull(),
    source: text("source"),
    createdAt: created(),
  },
  (t) => [
    check("waitlist_program", oneOf("program", ["monthly", "weekend", "summer"])),
    check("waitlist_country", sql`${t.country} IS NULL OR ${t.country} ~ '^[A-Z]{2}$'`),
    uniqueIndex("waitlist_email_program_uq").on(sql`lower(${t.email})`, t.program),
  ],
);

/* ── idempotency (a repeat submit gets its first answer for 30 minutes) ── */

export const idempotency = pgTable(
  "idempotency",
  {
    key: text("key").primaryKey(),
    state: text("state").notNull().default("running"),
    response: jsonb("response"),
    createdAt: created(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [
    check("idempotency_state", oneOf("state", ["running", "done"])),
    check("idempotency_key_format", sql`${t.key} ~ '^[A-Za-z0-9-]{16,64}$'`),
    check("idempotency_done_has_response", sql`${t.state} <> 'done' OR ${t.response} IS NOT NULL`),
  ],
);

/* ── rate_limits (keys are HMACs, never an IP or an email) ───────────── */

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    check("rate_limits_key_hashed", sql`${t.key} ~ '^[a-z]+:[a-f0-9]{32,64}$'`),
    check("rate_limits_count", sql`${t.count} >= 0`),
  ],
);

/* ── eligibility_blocks (hourly counts per country; no IP, no person) ─── */

/**
 * The plugin's iqu_enroll_blocks option (EL:262-279): how many submissions
 * the US/Canada check would block (monitor) or did block (enforce), per hour
 * and country, kept 8 days for the 9 PM summary. Only a country code and a count.
 */
export const eligibilityBlocks = pgTable(
  "eligibility_blocks",
  {
    hour: ts("hour").notNull(),
    mode: text("mode").notNull(),
    /** Two letters, or '??' when no country is known (EL:267). */
    country: char("country", { length: 2 }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.hour, t.mode, t.country] }),
    check("eligibility_blocks_mode", oneOf("mode", ["monitor", "enforce"])),
    check("eligibility_blocks_country", sql`${t.country} ~ '^([A-Z]{2}|\\?\\?)$'`),
    check("eligibility_blocks_hour", sql`date_trunc('hour', ${t.hour}) = ${t.hour}`),
    check("eligibility_blocks_count", sql`${t.count} > 0`),
  ],
);

/* ── outbox (Telegram, email and Meta sends, retried, never twice) ────── */

export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: created(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    check("outbox_kind", oneOf("kind", OUTBOX_KINDS)),
    check("outbox_status", oneOf("status", OUTBOX_STATUSES)),
    check("outbox_attempts", sql`${t.attempts} >= 0`),
    uniqueIndex("outbox_dedupe_uq").on(t.dedupeKey),
    index("outbox_due_idx").on(t.status, t.nextAttemptAt),
  ],
);

/* ── settings (admin switches) ───────────────────────────────────────── */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updated(),
  updatedBy: text("updated_by"),
});
