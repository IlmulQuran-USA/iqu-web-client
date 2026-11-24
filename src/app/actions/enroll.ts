"use server";

import { cookies, headers } from "next/headers";
import { consentFrom } from "@/lib/consent";
import { confirmationHref, type ConfirmationState, type Lead } from "@/lib/enroll/confirmation";
import { buildPluginFields, draftFieldOf } from "@/lib/enroll/payload";
import { draftSchema, stepOfField, todayIso, validateAll, type AppliedCoupon, type Errors, type StepId } from "@/lib/enroll/schema";
import { enrollConfig, postToPlugin, type EnrollConfig, type PluginReply } from "@/lib/server/enroll-wp";
import { ipHash } from "@/lib/server/hmac";
import { allow, clientKey } from "@/lib/server/rate-limit";
import { verifyRecaptcha } from "@/lib/server/recaptcha";
import { courseById } from "@/content/pricing";
import { site } from "@/content/site";

/*
 * /enroll server actions (enroll-architecture.md Option A).
 *
 * The draft is parsed and validated again here with the same rules as the
 * browser, reCAPTCHA v3 is verified for this host, and the request context
 * is added (country from Vercel, a hashed IP, Meta cookies, consent, user
 * agent). Then the body is HMAC-signed and posted to the plugin, which keeps
 * pricing, Stripe, the Zakat/Special ledger, emails and Telegram. Nothing is
 * ever faked: without a connection the action answers "not_connected".
 */

export type SubmitResult =
  | { status: "not_connected" }
  | { status: "ok"; href: string; external: boolean }
  | { status: "invalid"; step: StepId; errors: Errors; message: string }
  | { status: "blocked"; message: string; country: string }
  | { status: "error"; code: string; message: string };

const CONTACT = site.email ? ` or email ${site.email}` : "";
const MSG = {
  generic: `We couldn’t send your enrollment just now. Your answers are saved on this device. Please try again in a few minutes${CONTACT}.`,
  network: "We couldn’t reach our enrollment system. Your answers are saved on this device. Please try again.",
  verify: "We couldn’t verify this request. Please try again. If it keeps happening, reload the page.",
  busy: "Your enrollment is already being saved. Please wait a moment, then check your email.",
  rate: "We have already received several enrollments from you in the last hour. Please wait a little, or contact us and we will help.",
  invalid: "Some answers need another look. Please check the highlighted fields.",
  blocked:
    "We currently serve Muslim families in the United States and Canada only. When our classes open in your country, we will let you know by email.",
} as const;

const RECAPTCHA_ACTION = { monthly: "iqu_free_form", weekend: "iqu_weekend_form", summer: "iqu_summer_form" } as const;

async function requestContext(config: EnrollConfig) {
  const h = await headers();
  const jar = await cookies();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const consent = consentFrom((name) => jar.get(name)?.value);
  const country = (h.get("x-vercel-ip-country") ?? "").toUpperCase();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    host,
    ip,
    context: {
      ip_country: /^[A-Z]{2}$/.test(country) ? country : "",
      ip_hash: ip ? ipHash(config.secret, ip) : "",
      // Owner decision 1: the IP travels only with marketing consent, for Meta, and is never stored.
      ip: consent === "granted" ? ip : "",
      user_agent: (h.get("user-agent") ?? "").slice(0, 255),
      fbp: (jar.get("_fbp")?.value ?? "").slice(0, 100),
      fbc: (jar.get("_fbc")?.value ?? "").slice(0, 200),
      marketing_consent: consent,
      source_url: (h.get("referer") ?? "").slice(0, 500),
      // Stripe returns here (C6); the plugin accepts only its allow-listed origin.
      return_origin: host ? `${proto}://${host}` : "",
    },
  };
}

function leadOf(data: Record<string, unknown>): Lead | null {
  const eventId = typeof data.event_id === "string" ? data.event_id : "";
  const contentName = typeof data.content_name === "string" ? data.content_name : "";
  const value = typeof data.value === "number" ? data.value : Number(data.value);
  return eventId && contentName && Number.isFinite(value) ? { eventId, value, contentName } : null;
}

function confirmationState(variant: "monthly" | "weekend" | "summer", route: string, aid: boolean, existing: boolean): ConfirmationState {
  if (route === "details") return "details";
  if (variant === "weekend") return "weekend";
  if (variant === "summer") return existing ? "summer-existing" : "summer-review";
  return aid ? "aid" : "review";
}

function fieldErrors(reply: PluginReply): Errors {
  const out: Errors = {};
  for (const [field, message] of Object.entries(reply.errors)) {
    const key = draftFieldOf(field);
    if (key && message && !out[key]) out[key] = message;
  }
  return out;
}

export async function submitEnrollment(rawDraft: unknown, recaptchaToken: string, honeypot: string): Promise<SubmitResult> {
  const config = enrollConfig();
  if (!config) return { status: "not_connected" };

  // Honeypot: people never see it; a bot that fills it gets a quiet, generic page.
  if (honeypot) return { status: "ok", href: confirmationHref("review", null, null), external: false };

  const parsed = draftSchema.safeParse(rawDraft);
  if (!parsed.success) return { status: "error", code: "bad_draft", message: MSG.invalid };
  const draft = parsed.data;

  const problems = validateAll(draft, todayIso(new Date()));
  if (problems) return { status: "invalid", step: problems.step, errors: problems.errors, message: MSG.invalid };

  const { host, ip, context } = await requestContext(config);
  if (!allow(clientKey(`enroll|${ip}`), 10, 10 * 60_000)) return { status: "error", code: "rate_limited", message: MSG.rate };

  const captcha = await verifyRecaptcha(config.recaptchaSecret, recaptchaToken, RECAPTCHA_ACTION[draft.variant], host);
  if (!captcha.ok) return { status: "error", code: "recaptcha_failed", message: MSG.verify };

  const { form, fields } = buildPluginFields(draft, todayIso(new Date()));
  const reply = await postToPlugin(
    config,
    "",
    { v: 1, form, submit_id: draft.submitId, dry_run: false, fields, context: { ...context, recaptcha_score: captcha.score } },
    draft.submitId,
  );

  if (reply.ok) {
    const route = typeof reply.data.route === "string" ? reply.data.route : "";
    const reference = typeof reply.data.reference === "string" ? reply.data.reference : null;
    if (route === "card") {
      const url = typeof reply.data.checkout_url === "string" ? reply.data.checkout_url : "";
      if (/^https:\/\/checkout\.stripe\.com\//.test(url)) return { status: "ok", href: url, external: true };
      // A card route without a usable Stripe page: the plugin has already sent it to review.
      return { status: "ok", href: confirmationHref("review", reference, null), external: false };
    }
    // Owner decision 12: a details-only update sends no Lead.
    const lead = route === "details" ? null : leadOf(reply.data);
    const state = confirmationState(draft.variant, route, draft.feeChoice === "help" || draft.summerFee === "help", draft.summerFee === "existing");
    return { status: "ok", href: confirmationHref(state, reference, lead), external: false };
  }

  switch (reply.code) {
    case "validation_failed":
    case "coupon_invalid":
    case "coupon_busy":
    case "declaration_required":
    case "discount_conflict":
    case "special_discount_invalid":
    case "pricing_failed": {
      const errors = fieldErrors(reply);
      if (reply.code.startsWith("coupon") && !errors.couponCode) errors.couponCode = reply.message || "This code could not be used.";
      if (reply.code === "declaration_required" && !errors.zakatDeclaration) errors.zakatDeclaration = reply.message;
      if (reply.code === "pricing_failed" && !errors.daysPerWeek) errors.daysPerWeek = reply.message;
      const first = Object.keys(errors)[0];
      return {
        status: "invalid",
        step: first ? stepOfField(draft.variant, first) : "review",
        errors,
        message: reply.message || MSG.invalid,
      };
    }
    case "location_blocked":
      return {
        status: "blocked",
        message: reply.message || MSG.blocked,
        country: typeof reply.data.country === "string" ? reply.data.country : "",
      };
    case "rate_limited":
      return { status: "error", code: reply.code, message: reply.message || MSG.rate };
    case "in_progress":
      return { status: "error", code: reply.code, message: MSG.busy };
    case "unreachable":
      return { status: "error", code: reply.code, message: MSG.network };
    default:
      if (reply.status === 401) console.error("[enroll] the plugin refused the signature (401). Check IQU_NEXT_HMAC_SECRET.");
      else console.error(`[enroll] plugin answered ${reply.status} ${reply.code}`);
      return { status: "error", code: reply.code || "error", message: MSG.generic };
  }
}

/* ── Scholarship code ─────────────────────────────────────────────────── */

export type CouponResult =
  | { status: "not_connected" }
  | { status: "ok"; coupon: AppliedCoupon; message: string }
  | { status: "error"; message: string };

export async function checkCoupon(input: {
  code: string;
  courseId: string;
  daysPerWeek: number;
  recaptchaToken: string;
}): Promise<CouponResult> {
  const config = enrollConfig();
  if (!config) return { status: "not_connected" };
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) return { status: "error", message: "Check the code: it uses letters, numbers and dashes." };
  let course;
  try {
    course = courseById(input.courseId as never);
  } catch {
    return { status: "error", message: "Choose your course before applying a code." };
  }
  const { host, ip, context } = await requestContext(config);
  // The plugin's own limit is 20 tries an hour per visitor; this blunts a flood before it.
  if (!allow(clientKey(`coupon|${ip}`), 20, 60 * 60_000)) {
    return { status: "error", message: "Too many attempts. Please wait a while and try again, or contact us for help." };
  }
  const captcha = await verifyRecaptcha(config.recaptchaSecret, input.recaptchaToken, "iqu_apply_coupon", host);
  if (!captcha.ok) return { status: "error", message: MSG.verify };

  const reply = await postToPlugin(config, "/coupon", {
    v: 1,
    coupon_code: code,
    course_type: course.priceKey,
    course_variant: course.id,
    days_per_week: input.daysPerWeek,
    context,
  });
  if (!reply.ok) {
    return { status: "error", message: reply.message || (reply.code === "unreachable" ? MSG.network : "This code could not be checked.") };
  }
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const coupon: AppliedCoupon = {
    code: typeof reply.data.code === "string" ? reply.data.code : code,
    discount: num(reply.data.discount_amount),
    final: num(reply.data.final_amount),
    percent: num(reply.data.discount_percent),
    declaration: typeof reply.data.declaration_text === "string" ? reply.data.declaration_text : "",
  };
  if (![coupon.discount, coupon.final, coupon.percent].every(Number.isFinite) || !coupon.declaration) {
    return { status: "error", message: "This code could not be checked." };
  }
  return { status: "ok", coupon, message: reply.message };
}

/* ── Waitlist (families outside the US and Canada, enforce mode) ──────── */

export type WaitlistResult = { status: "not_connected" } | { status: "ok"; message: string } | { status: "error"; message: string };

export async function joinWaitlist(input: {
  email: string;
  name: string;
  program: "monthly" | "weekend" | "summer";
  country: string;
  recaptchaToken: string;
}): Promise<WaitlistResult> {
  const config = enrollConfig();
  if (!config) return { status: "not_connected" };
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 191) {
    return { status: "error", message: "Enter an email address in the format name@example.com." };
  }
  const { host, ip, context } = await requestContext(config);
  if (!allow(clientKey(`waitlist|${ip}`), 5, 60 * 60_000)) {
    return { status: "error", message: "Too many attempts. Please try again later." };
  }
  const captcha = await verifyRecaptcha(config.recaptchaSecret, input.recaptchaToken, "iqu_waitlist", host);
  if (!captcha.ok) return { status: "error", message: MSG.verify };
  const program = { monthly: "free", weekend: "weekend", summer: "summer" }[input.program];
  const reply = await postToPlugin(config, "/waitlist", {
    v: 1,
    email,
    name: input.name.trim().slice(0, 100),
    program,
    country: /^[A-Z]{2}$/.test(input.country) ? input.country : "",
    source: "enroll",
    context,
  });
  if (!reply.ok) return { status: "error", message: reply.message || MSG.network };
  return {
    status: "ok",
    message: "JazakAllahu Khairan! We will email you when our classes open in your country, in sha’ Allah.",
  };
}
