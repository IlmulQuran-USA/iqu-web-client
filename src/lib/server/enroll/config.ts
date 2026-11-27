import { site } from "../../../content/site.ts";
import { portalData } from "../../site-env.ts";
import type { Queryable } from "../../../db/types.ts";
import { gmailConfig } from "../outbox/gmail.ts";
import type { Adapters } from "../outbox/outbox.ts";
import { telegramConfig } from "../outbox/telegram.ts";
import { readSettings } from "./settings.ts";

/*
 * When /enroll is "connected" (SERVER ONLY). Settings (names in .env.example):
 *   DATABASE_URL           Neon, set by the Vercel integration per environment
 *   RECAPTCHA_SITE_KEY     reCAPTCHA v3 for the Next hosts
 *   RECAPTCHA_SECRET_KEY
 *   IQU_HASH_SECRET        ≥ 32 characters: the HMAC key for rate-limit keys
 * Without any of them the form still works and autosaves; on the dev preview
 * it is sent through the mock adapter (enrollPreview, below), and anywhere
 * else Review says sending is being set up. It never links to the old
 * WordPress form (owner, 27 Nov 2026).
 *
 * Production: not connected in P1. The card step (Stripe) arrives in P2, and
 * the public site keeps the WordPress form until cutover, so nothing can be
 * saved there as "waiting for a card" that no one can finish.
 */

export type EnrollConfig = {
  recaptchaSiteKey: string;
  recaptchaSecret: string;
  hashSecret: string;
  mode: "test" | "live";
  /** False until P2 connects Stripe. */
  cardStepLive: boolean;
};

export function enrollConfig(env: NodeJS.ProcessEnv = process.env): EnrollConfig | null {
  const database = env.DATABASE_URL?.trim() ?? "";
  const recaptchaSiteKey = env.RECAPTCHA_SITE_KEY?.trim() ?? "";
  const recaptchaSecret = env.RECAPTCHA_SECRET_KEY?.trim() ?? "";
  const hashSecret = env.IQU_HASH_SECRET?.trim() ?? "";
  if (!database || !recaptchaSiteKey || !recaptchaSecret || hashSecret.length < 32) return null;
  if (env.NEXT_PUBLIC_SITE_ENV === "production") return null;
  return { recaptchaSiteKey, recaptchaSecret, hashSecret, mode: "test", cardStepLive: false };
}

/**
 * The dev preview's enrollment (owner, 27 Nov 2026): where the live path is not
 * connected and the portal runs on mock data (staging only; never on the
 * public site, src/lib/site-env.ts portalData), the form is sent through the
 * mock adapter (src/data/mock/enrollment.ts): validated as the live path
 * does, saved nowhere, sent nowhere, charged nothing.
 */
export function enrollPreview(env: NodeJS.ProcessEnv = process.env): boolean {
  return enrollConfig(env) === null && portalData(env) === "mock";
}

/** The team inbox for admin notifications: the Gmail account itself (GMAIL_SENDER). */
export function adminInbox(env: NodeJS.ProcessEnv = process.env): string | null {
  const sender = env.GMAIL_SENDER?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender) ? sender : null;
}

export async function outboxAdapters(db: Queryable, env: NodeJS.ProcessEnv = process.env): Promise<Adapters> {
  const settings = await readSettings(db);
  return { telegram: telegramConfig(env, settings.telegramLiveChatPattern), gmail: gmailConfig(env), fromName: site.name };
}
