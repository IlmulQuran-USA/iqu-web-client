"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { getDb } from "@/db";
import { consentFrom } from "@/lib/consent";
import type { AppliedCoupon, Errors, StepId } from "@/lib/enroll/schema";
import { getData } from "@/data";
import { confirmationHref } from "@/lib/enroll/confirmation";
import { enrollConfig, enrollPreview, adminInbox, outboxAdapters, type EnrollConfig } from "@/lib/server/enroll/config";
import { joinWaitlistCore, quoteCouponCore } from "@/lib/server/enroll/quote";
import { submitEnrollmentCore, type CaptchaCheck } from "@/lib/server/enroll/submit";
import { clientIp } from "@/lib/server/keys";
import { deliverOutbox } from "@/lib/server/outbox/outbox";
import { verifyRecaptcha } from "@/lib/server/recaptcha";

/*
 * /enroll server actions: enrollment runs on Next.js only (owner, 24 Nov
 * 2026; architecture §2.1). The draft is validated again with the browser's
 * rules, checked by reCAPTCHA v3 for this host, and saved in our database in
 * one transaction (src/lib/server/enroll/submit.ts). Telegram and emails are
 * outbox rows, delivered right after the response and retried by
 * /api/cron/outbox. Without the database, the reCAPTCHA keys or
 * IQU_HASH_SECRET the actions answer "not_connected" and Review says sending
 * is being set up; on the dev preview only (enrollPreview), the submit goes
 * through the mock adapter instead and saves, sends and charges nothing.
 * No answer ever points at the old WordPress form (owner, 27 Nov 2026).
 */

export type SubmitResult =
  | { status: "not_connected" }
  | { status: "ok"; href: string; external: boolean }
  | { status: "invalid"; step: StepId; errors: Errors; message: string }
  | { status: "blocked"; message: string; country: string }
  | { status: "error"; code: string; message: string };

async function requestInfo() {
  const h = await headers();
  const jar = await cookies();
  const country = (h.get("x-vercel-ip-country") ?? "").toUpperCase();
  return {
    ip: clientIp((name) => h.get(name)),
    ipCountry: /^[A-Z]{2}$/.test(country) ? country : "",
    host: h.get("x-forwarded-host") ?? h.get("host") ?? "",
    fbp: (jar.get("_fbp")?.value ?? "").slice(0, 100),
    fbc: (jar.get("_fbc")?.value ?? "").slice(0, 200),
    consent: consentFrom((name) => jar.get(name)?.value),
  };
}

function captcha(config: EnrollConfig): CaptchaCheck {
  return (token, action, host) => verifyRecaptcha(config.recaptchaSecret, token, action, host);
}

/** Send the rows this request wrote, after the response; the cron retries whatever fails. */
function deliverAfterResponse(ids: number[]) {
  if (!ids.length) return;
  after(async () => {
    try {
      const db = getDb();
      await deliverOutbox(db, await outboxAdapters(db), { ids });
    } catch (error) {
      console.error(`[outbox] delivery after submit failed: ${(error as Error).message.slice(0, 200)}`);
    }
  });
}

export async function submitEnrollment(rawDraft: unknown, recaptchaToken: string, honeypot: string): Promise<SubmitResult> {
  const config = enrollConfig();
  if (!config) {
    if (!enrollPreview()) return { status: "not_connected" };
    // The dev preview: the mock adapter validates and answers; nothing is saved, sent or charged.
    if (honeypot) return { status: "ok", href: confirmationHref("review", null, null), external: false };
    return (await getData().enrollment.submit(rawDraft, new Date())) as SubmitResult;
  }
  const db = getDb();
  const result = await submitEnrollmentCore(
    db,
    { rawDraft, recaptchaToken: String(recaptchaToken ?? ""), honeypot: String(honeypot ?? ""), request: await requestInfo() },
    {
      now: new Date(),
      mode: config.mode,
      hashSecret: config.hashSecret,
      verifyCaptcha: captcha(config),
      newEventId: () => `lead_${randomUUID()}`,
      adminEmailTo: adminInbox(),
      cardStepLive: config.cardStepLive,
    },
  );
  if (result.status !== "ok") return result;
  deliverAfterResponse(result.outboxIds);
  return { status: "ok", href: result.href, external: false };
}

/* ── Scholarship code ─────────────────────────────────────────────────── */

export type CouponResult =
  | { status: "not_connected" }
  | { status: "ok"; coupon: AppliedCoupon; message: string }
  | { status: "error"; message: string };

export async function checkCoupon(input: { code: string; courseId: string; daysPerWeek: number; recaptchaToken: string }): Promise<CouponResult> {
  const config = enrollConfig();
  if (!config) return { status: "not_connected" };
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) return { status: "error", message: "Check the code: it uses letters, numbers and dashes." };
  const { ip, host } = await requestInfo();
  const db = getDb();
  return quoteCouponCore(
    db,
    { code, courseId: String(input.courseId ?? ""), daysPerWeek: Number(input.daysPerWeek) || 0, recaptchaToken: String(input.recaptchaToken ?? ""), ip, host },
    { now: new Date(), hashSecret: config.hashSecret, verifyCaptcha: captcha(config) },
  );
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
  const program = input.program === "weekend" || input.program === "summer" ? input.program : "monthly";
  const { ip, host } = await requestInfo();
  return joinWaitlistCore(
    getDb(),
    {
      email: String(input.email ?? ""),
      name: String(input.name ?? ""),
      program,
      country: String(input.country ?? ""),
      recaptchaToken: String(input.recaptchaToken ?? ""),
      ip,
      host,
    },
    { now: new Date(), hashSecret: config.hashSecret, verifyCaptcha: captcha(config) },
  );
}
