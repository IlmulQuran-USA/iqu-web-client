"use server";

import { headers } from "next/headers";
import { newsletterConfig, requestDoubleOptIn } from "@/lib/server/brevo";
import { allow, clientKey } from "@/lib/server/rate-limit";

/**
 * Footer newsletter sign-up (spec §6.2; owner decision, 19 Nov 2026).
 *
 * Server-side only: validates the address, checks a honeypot and a per-IP
 * rate limit (the IP is hashed, never stored), then asks Brevo to send its
 * double opt-in email. A contact that already exists gets the same success
 * message, so nothing reveals whether an email is on file. Errors are plain
 * words and the typed email always comes back, so a retry is one click.
 */

export type NewsletterState =
  | { status: "idle"; email: string }
  | { status: "error"; email: string; field?: "email"; message: string }
  | { status: "success"; email: string; message: string };

const SUCCESS = "Check your inbox to confirm your subscription.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT = { attempts: 5, windowMs: 10 * 60_000 };

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const email = String(formData.get("email") ?? "").trim();

  // Honeypot: people never see or fill this field; bots that do get a quiet "success".
  if (String(formData.get("website") ?? "") !== "") {
    return { status: "success", email: "", message: SUCCESS };
  }

  if (!email) {
    return { status: "error", email, field: "email", message: "Enter your email address." };
  }
  if (email.length > 254 || !EMAIL.test(email)) {
    return {
      status: "error",
      email,
      field: "email",
      message: "Enter an email address in the format name@example.com.",
    };
  }

  const config = newsletterConfig();
  if (!config) {
    // The footer hides the form in this case; this only guards a stale page.
    return { status: "error", email, message: "Sign-up opens soon." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!allow(clientKey(ip), RATE_LIMIT.attempts, RATE_LIMIT.windowMs)) {
    return {
      status: "error",
      email,
      message: "Too many attempts from this connection. Please wait a few minutes and try again.",
    };
  }

  const result = await requestDoubleOptIn(config, email);
  if (result === "failed") {
    return {
      status: "error",
      email,
      message: "We couldn’t sign you up just now. Please try again in a few minutes.",
    };
  }
  return { status: "success", email: "", message: SUCCESS };
}
