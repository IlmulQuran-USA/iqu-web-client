import { and, eq, ne, sql } from "drizzle-orm";
import { auditLog, couponRedemptions, families, familyMembers, idempotency, registrations, reviewReasons } from "../../../db/schema.ts";
import type { AnyDb, Queryable } from "../../../db/types.ts";
import type { Consent } from "../../consent.ts";
import { confirmationHref, type ConfirmationState, type Lead } from "../../enroll/confirmation.ts";
import { phonesOf, programLabel, programOf, registrationFields, type Program, type RegistrationInsert } from "../../enroll/record.ts";
import { draftSchema, stepOfField, todayIso, validateAll, type Draft, type Errors, type StepId } from "../../enroll/schema.ts";
import { hashKey } from "../keys.ts";
import { enqueue, type OutboxRow } from "../outbox/outbox.ts";
import { bump, LIMITS, under } from "../rate.ts";
import { checkCouponCode, type CouponQuote } from "./coupon.ts";
import { countCouponFailure, countCouponTry, couponGuard, couponIpKey } from "./coupon-guard.ts";
import { applyEligibility, BLOCK_MESSAGE, checkEligibility } from "./eligibility.ts";
import { adminEmail, detailsUpdatedTelegram, familyEmail, newRegistrationTelegram, type FamilyEmailKind, type Snapshot } from "./messages.ts";
import { isPriceError, priceMonthly } from "./price.ts";
import { detailsOnly, findMatch, isActive, withoutKept } from "./reenroll.ts";
import { decideRoute, type RouteDecision, type Route } from "./route.ts";
import { readSettings } from "./settings.ts";

/*
 * submitEnrollment on Next.js (architecture §2.1, owner decision of 24 Nov
 * 2026: enrollment runs on Next only). The order is the live plugin's
 * submit handler (public/class-iqu-form.php:927-1151) with the Next changes:
 *
 *  1  parse the draft (the same zod schema as the browser)
 *  2  claim the submit id (idempotency; SG:48-67): a repeat of a finished
 *     submission gets its first answer, a repeat while it runs gets "already
 *     being saved", a claim older than 120 s is taken over
 *  3  honeypot: a quiet, generic success; nothing saved (F:935-938)
 *  4  the same step rules as the browser (validateAll)
 *  5  reCAPTCHA v3 (action per program, score, hostname)
 *  6  eligibility US/CA with the settings mode (EL:185-256)
 *  7  price in cents from pricing.ts; Special plan only with "I can pay"
 *  8  rate limits: 15 per IP hash and 8 per email hash an hour (SG:80-90)
 *  9  ONE transaction: coupon re-checked under a row lock and redeemed;
 *     re-enrollment match (RE); sibling check; route; registration (new,
 *     details-only, or returning); review reasons; family + member (card);
 *     outbox rows (Telegram, admin and family email, Meta Lead) AFTER the
 *     route is known (N8); rate counts; the idempotency answer
 * 10  any failure releases the claim, so the family can fix and resend
 *
 * The Stripe step is P2. Until then the card and Summer payment routes are
 * saved as waiting (card_pending / stripe_pending) and the confirmation says
 * the card step is not connected yet. Nothing is ever charged or faked.
 */

export type RequestInfo = {
  /** The visitor's IP, only to derive the rate-limit HMAC. Never stored. */
  ip: string;
  /** From x-vercel-ip-country; "" when unknown. */
  ipCountry: string;
  host: string;
  fbp: string;
  fbc: string;
  consent: Consent;
};

export type CaptchaCheck = (token: string, action: string, host: string) => Promise<{ ok: true; score: number } | { ok: false; reason: string }>;

export type EnrollDeps = {
  now: Date;
  /** Stripe mode of this deployment: live only on the production site. */
  mode: "test" | "live";
  hashSecret: string;
  verifyCaptcha: CaptchaCheck;
  newEventId: () => string;
  /** The team inbox for the admin notification (GMAIL_SENDER), or null. */
  adminEmailTo: string | null;
  /** False until P2 connects Stripe. */
  cardStepLive: boolean;
};

export type SubmitOk = { status: "ok"; route: Route; href: string; reference: string | null; repeat?: boolean };

export type EnrollResult =
  | (SubmitOk & { outboxIds: number[] })
  | { status: "invalid"; step: StepId; errors: Errors; message: string }
  | { status: "blocked"; message: string; country: string }
  | { status: "error"; code: string; message: string };

export const MESSAGES = {
  invalid: "Some answers need another look. Please check the highlighted fields.",
  verify: "We couldn’t verify this request. Please try again. If it keeps happening, reload the page.",
  busy: "Your enrollment is already being saved. Please wait a moment.",
  rate: "We have already received several enrollments from you in the last hour. Please wait a little, or contact us and we will help.",
  declaration: "Please confirm the Zakat eligibility declaration to continue.",
  generic: "We couldn’t send your enrollment just now. Your answers are saved on this device. Please try again in a few minutes.",
} as const;

const RECAPTCHA_ACTION = { monthly: "iqu_free_form", weekend: "iqu_weekend_form", summer: "iqu_summer_form" } as const;
const REPLAY_MS = 30 * 60_000;
const STALE_CLAIM_MS = 120_000;

/* ── Idempotency ─────────────────────────────────────────────────────── */

type Claim = { kind: "claimed" } | { kind: "repeat"; result: SubmitOk } | { kind: "busy" };

async function claimSubmit(db: Queryable, key: string, now: Date): Promise<Claim> {
  const expiresAt = new Date(now.getTime() + REPLAY_MS);
  const inserted = await db
    .insert(idempotency)
    .values({ key, state: "running", createdAt: now, expiresAt })
    .onConflictDoNothing({ target: idempotency.key })
    .returning({ key: idempotency.key });
  if (inserted.length) return { kind: "claimed" };

  const [row] = await db.select().from(idempotency).where(eq(idempotency.key, key));
  if (row?.state === "done" && row.expiresAt > now && row.response) return { kind: "repeat", result: { ...(row.response as SubmitOk), repeat: true } };
  if (row?.state === "running" && now.getTime() - row.createdAt.getTime() < STALE_CLAIM_MS) return { kind: "busy" };
  // A finished answer past its 30 minutes, or a request that died: take it over atomically.
  const taken = await db
    .update(idempotency)
    .set({ state: "running", response: null, createdAt: now, expiresAt })
    .where(and(eq(idempotency.key, key), row ? eq(idempotency.createdAt, row.createdAt) : sql`true`))
    .returning({ key: idempotency.key });
  return taken.length ? { kind: "claimed" } : { kind: "busy" };
}

async function releaseClaim(db: Queryable, key: string): Promise<void> {
  await db.delete(idempotency).where(and(eq(idempotency.key, key), eq(idempotency.state, "running")));
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** K1: a new public student's first charge is the first 1st on or after signup + 30 days. */
export function firstChargeDate(now: Date): string {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30));
  const first = end.getUTCDate() === 1 ? end : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1));
  return first.toISOString().slice(0, 10);
}

function confirmationState(draft: Draft, route: Route): ConfirmationState {
  switch (route) {
    case "card":
      return "card-next";
    case "summer_pay":
      return "summer-next";
    case "aid":
      return "aid";
    case "details":
      return "details";
    case "weekend":
      return "weekend";
    default:
      if (draft.variant === "summer") return draft.summerFee === "existing" ? "summer-existing" : "summer-review";
      return "review";
  }
}

function familyEmailKind(draft: Draft, route: Route): FamilyEmailKind {
  if (route === "review" && draft.variant === "summer" && draft.summerFee === "existing") return "summer_existing";
  return route;
}

class CouponRefused extends Error {}

function invalid(variant: Draft["variant"], errors: Errors, message: string = MESSAGES.invalid): EnrollResult {
  const first = Object.keys(errors)[0] ?? "";
  return { status: "invalid", step: stepOfField(variant, first), errors, message };
}

/* ── The submission ──────────────────────────────────────────────────── */

export async function submitEnrollmentCore(
  db: AnyDb,
  input: { rawDraft: unknown; recaptchaToken: string; honeypot: string; request: RequestInfo },
  deps: EnrollDeps,
): Promise<EnrollResult> {
  const { now } = deps;
  const parsed = draftSchema.safeParse(input.rawDraft);
  if (!parsed.success) return { status: "error", code: "bad_draft", message: MESSAGES.invalid };
  const draft = parsed.data;

  const claim = await claimSubmit(db, draft.submitId, now);
  if (claim.kind === "repeat") return { ...claim.result, outboxIds: [] };
  if (claim.kind === "busy") return { status: "error", code: "in_progress", message: MESSAGES.busy };

  let done = false;
  try {
    // Honeypot: people never see the field. A bot gets the generic page; nothing is saved.
    if (input.honeypot) return { status: "ok", route: "review", href: confirmationHref("review", null, null), reference: null, outboxIds: [] };

    const today = todayIso(now);
    const problems = validateAll(draft, today);
    if (problems) return { status: "invalid", step: problems.step, errors: problems.errors, message: MESSAGES.invalid };

    const captcha = await deps.verifyCaptcha(input.recaptchaToken, RECAPTCHA_ACTION[draft.variant], input.request.host);
    if (!captcha.ok) return { status: "error", code: "recaptcha_failed", message: MESSAGES.verify };

    const settings = await readSettings(db);
    const eligibility = applyEligibility(
      settings.countryCheck,
      checkEligibility({ phones: phonesOf(draft), residence: draft.residence, ipCountry: input.request.ipCountry }),
    );
    if (eligibility.blocked) return { status: "blocked", message: BLOCK_MESSAGE, country: eligibility.country };

    // Price (monthly): the browser's amounts are never used.
    const price = draft.variant === "monthly" && draft.courseId ? priceMonthly(draft.courseId, draft.daysPerWeek, draft.feeChoice === "pay" && draft.special) : null;
    if (price && isPriceError(price)) return invalid(draft.variant, { [price.field === "special" ? "special" : "daysPerWeek"]: price.message }, price.message);
    const couponCode = draft.variant === "monthly" && draft.feeChoice === "code" ? (draft.couponApplied?.code ?? draft.couponCode).trim().toUpperCase() : "";
    if (couponCode && !draft.zakatDeclaration) return invalid(draft.variant, { zakatDeclaration: MESSAGES.declaration }, MESSAGES.declaration);
    // The guessing guard of "Apply" also covers the submit: a bot could post codes straight here (F:1034-1039).
    const couponKey = couponIpKey(deps.hashSecret, input.request.ip);
    if (couponCode) {
      const guard = await couponGuard(db, deps.hashSecret, couponKey, now);
      if (guard) return invalid(draft.variant, { couponCode: guard }, guard);
    }

    // Rate limits (checked before saving, counted only on success).
    const email = draft.email.trim().toLowerCase();
    const ipKey = input.request.ip ? hashKey(deps.hashSecret, "ip", input.request.ip) : null;
    const emailKey = hashKey(deps.hashSecret, "email", email);
    if ((ipKey && !(await under(db, ipKey, LIMITS.enrollIp, now))) || !(await under(db, emailKey, LIMITS.enrollEmail, now))) {
      return { status: "error", code: "rate_limited", message: MESSAGES.rate };
    }

    const program: Program = programOf(draft, today);
    const eventId = deps.newEventId();

    const result = await db.transaction(async (tx) => {
      // Coupon, under a row lock: validated and redeemed in this one transaction.
      let coupon: CouponQuote | null = null;
      if (couponCode && price && !isPriceError(price)) {
        const check = await checkCouponCode(tx, { code: couponCode, priceKey: price.course.priceKey, baseCents: price.calculatedCents, now, lock: true });
        if (!check.ok) throw new CouponRefused(check.message);
        coupon = check.quote;
      }

      const match = await findMatch(tx, { program, email, firstName: draft.firstName, lastName: draft.lastName });
      const active = match ? await isActive(tx, match, deps.mode) : false;
      const returning = Boolean(match && !active);

      const discountCents = price && !isPriceError(price) ? (coupon ? coupon.discountCents : price.specialDiscountCents) : 0;
      const paymentCents = price && !isPriceError(price) ? price.calculatedCents - discountCents : null;

      let sibling = false;
      if (draft.variant === "monthly" && !active) {
        const [fam] = await tx
          .select({ id: families.id })
          .from(families)
          .where(and(sql`lower(${families.contactEmail}) = ${email}`, eq(families.mode, deps.mode), ne(families.status, "canceled")))
          .limit(1);
        sibling = Boolean(fam);
      }

      const decision: RouteDecision =
        draft.variant === "weekend"
          ? decideRoute({ variant: "weekend", location: eligibility.details })
          : draft.variant === "summer"
            ? decideRoute({
                variant: "summer",
                activeMatch: active,
                fee: draft.summerFee === "existing" ? "existing" : draft.summerFee === "help" ? "help" : "standard",
                feeCents: settings.summerFeeCents,
                location: eligibility.details,
              })
            : decideRoute({
                variant: "monthly",
                activeMatch: active,
                returning,
                existing: draft.existing,
                aid: draft.feeChoice === "help",
                couponUsed: Boolean(coupon),
                finalCents: paymentCents ?? 0,
                sibling,
                freePaymentStep: settings.freePaymentStep,
                location: eligibility.details,
              });

      // The row as submitted, with the server's money and route.
      const fields: RegistrationInsert = {
        ...registrationFields(draft, today, now),
        countryIp: eligibility.ipCountry || null,
        marketingConsent: input.request.consent,
        // Meta browser ids only with marketing consent (decision 1). No IP and no user agent are stored.
        fbp: input.request.consent === "granted" ? input.request.fbp || null : null,
        fbc: input.request.consent === "granted" ? input.request.fbc || null : null,
        userAgent: null,
      };
      if (price && !isPriceError(price)) {
        Object.assign(fields, {
          perClassCents: price.perClassCents,
          calculatedCents: price.calculatedCents,
          discountCents,
          paymentCents,
          specialPlan: !coupon && price.specialDiscountCents > 0,
          couponId: coupon?.couponId ?? null,
          zakatDeclaration: Boolean(coupon),
          zakatDeclarationText: coupon?.declaration ?? null,
          declaredAt: coupon ? now : null,
        } satisfies Partial<RegistrationInsert>);
      }
      if (draft.variant === "summer" && draft.summerFee === "standard") {
        Object.assign(fields, { paymentCents: settings.summerFeeCents, paymentMethod: "stripe", stripeMode: deps.mode } satisfies Partial<RegistrationInsert>);
      }
      // RE:70-79: a returning monthly student is an existing student (no second free month), whatever they answered.
      if (returning && program === "monthly") fields.existingStudent = true;
      if (decision.status) fields.status = decision.status;
      if (decision.paymentStatus) fields.paymentStatus = decision.paymentStatus;

      // Write: details only (active), the whole submission over a returning record, or a new row.
      let id: number;
      if (match && active) {
        id = match.id;
        await tx
          .update(registrations)
          .set({ ...detailsOnly(fields), reenrolledAt: now, archivedAt: null, archivedBy: null, updatedAt: now })
          .where(eq(registrations.id, id));
      } else if (match) {
        id = match.id;
        await tx
          .update(registrations)
          .set({ ...withoutKept(fields), leftAt: null, billingEndedAt: null, reenrolledAt: now, archivedAt: null, archivedBy: null, updatedAt: now })
          .where(eq(registrations.id, id));
        if (program === "monthly") await detachEnded(tx, id, deps.mode, now);
      } else {
        const [row] = await tx.insert(registrations).values(fields).returning({ id: registrations.id });
        id = row.id;
      }

      if (decision.reasons.length) {
        await tx
          .insert(reviewReasons)
          .values(decision.reasons.map((r) => ({ registrationId: id, reason: r.reason, detail: r.detail, openedAt: now })))
          .onConflictDoNothing();
      }
      if (coupon && decision.route !== "details") {
        await tx.insert(couponRedemptions).values({ couponId: coupon.couponId, registrationId: id, redeemedAt: now }).onConflictDoNothing();
      }

      if (decision.route === "card") {
        const charge = firstChargeDate(now);
        const [fam] = await tx
          .insert(families)
          .values({
            mode: deps.mode,
            guardianName: fields.guardianName ?? `${fields.firstName} ${fields.lastName}`,
            contactEmail: email,
            contactWhatsapp: fields.whatsappE164 ?? null,
            studentType: "new",
            monthlyCents: paymentCents ?? 0,
            discountCents: 0,
            netCents: paymentCents ?? 0,
            firstChargeDate: charge,
            status: "not_sent",
            createdBy: "public",
          })
          .returning({ id: families.id });
        await tx.insert(familyMembers).values({ familyId: fam.id, registrationId: id, mode: deps.mode, amountCents: paymentCents ?? 0, firstChargeDate: charge });
        await tx.update(registrations).set({ familyId: fam.id }).where(eq(registrations.id, id));
      }

      // Notifications, written now and sent after the response (outbox).
      const snapshot: Snapshot = { ...fields, id, program, couponCode: coupon?.code ?? null };
      const rows: OutboxRow[] = [];
      const key = (what: string) => `${what}:${id}:${draft.submitId}`;
      if (decision.route === "details") {
        rows.push(
          { kind: "telegram", dedupeKey: key("tg:details"), payload: { template: "details_updated", html: detailsUpdatedTelegram(snapshot, now) } },
          { kind: "email", dedupeKey: key("email:details"), payload: { template: "family_details", ...familyEmail("details", snapshot) } },
        );
      } else {
        const status = decision.status ?? "pending";
        const context = { snapshot: { ...snapshot, status }, route: decision.route, status, reasons: decision.reasons, returning, cardStepLive: deps.cardStepLive, now };
        rows.push({ kind: "telegram", dedupeKey: key("tg:new"), payload: { template: "new_registration", html: newRegistrationTelegram(context) } });
        if (deps.adminEmailTo) rows.push({ kind: "email", dedupeKey: key("email:admin"), payload: { template: "admin_new", ...adminEmail(deps.adminEmailTo, context) } });
        const kind = familyEmailKind(draft, decision.route);
        rows.push({ kind: "email", dedupeKey: key("email:family"), payload: { template: `family_${kind}`, ...familyEmail(kind, snapshot) } });
        rows.push({
          kind: "meta",
          dedupeKey: `meta:lead:${eventId}`,
          payload: { template: "meta_lead", event: "Lead", eventId, registrationId: id, contentName: programLabel(program), valueCents: snapshot.paymentCents ?? 0 },
        });
      }
      const outboxIds = await enqueue(tx, rows, now);

      if (ipKey) await bump(tx, ipKey, now);
      await bump(tx, emailKey, now);

      // Owner decision 12: a details-only update sends no Lead.
      const lead: Lead | null =
        decision.route === "details" ? null : { eventId, value: (snapshot.paymentCents ?? 0) / 100, contentName: programLabel(program) };
      const reference = `IQU-${id}`;
      const answer: SubmitOk = { status: "ok", route: decision.route, href: confirmationHref(confirmationState(draft, decision.route), reference, lead), reference };
      await tx.update(idempotency).set({ state: "done", response: answer }).where(eq(idempotency.key, draft.submitId));
      return { ...answer, outboxIds };
    });
    done = true;
    return result;
  } catch (error) {
    if (error instanceof CouponRefused) {
      // F:1042-1044: a refused code counts as a try for this visitor and as a site-wide failure.
      await countCouponTry(db, couponIpKey(deps.hashSecret, input.request.ip), now).catch(() => undefined);
      await countCouponFailure(db, deps.hashSecret, now).catch(() => undefined);
      return invalid(draft.variant, { couponCode: error.message }, error.message);
    }
    console.error(`[enroll] submit failed: ${(error as Error).message.slice(0, 200)}`);
    return { status: "error", code: "error", message: MESSAGES.generic };
  } finally {
    if (!done) await releaseClaim(db, draft.submitId).catch(() => undefined);
  }
}

/**
 * RE:120-131: a returning monthly student is taken off a family whose billing
 * has ended (canceled), so a new payment link can be sent. The family keeps
 * its invoices. Logged as "detached".
 */
async function detachEnded(tx: Queryable, registrationId: number, mode: "test" | "live", now: Date): Promise<void> {
  const [member] = await tx
    .select({ id: familyMembers.id, familyId: familyMembers.familyId, status: families.status })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(and(eq(familyMembers.registrationId, registrationId), eq(familyMembers.mode, mode)))
    .limit(1);
  if (!member || member.status !== "canceled") return;
  await tx.delete(familyMembers).where(eq(familyMembers.id, member.id));
  await tx.update(registrations).set({ familyId: null }).where(eq(registrations.id, registrationId));
  await tx.insert(auditLog).values({
    actor: "system:enroll",
    action: "detached",
    entity: "registration",
    entityId: String(registrationId),
    familyId: member.familyId,
    registrationId,
    mode,
    reason: "Re-enrolled on the website",
    at: now,
  });
}
