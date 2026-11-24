/*
 * Stripe key guard (architecture §6). SERVER ONLY.
 *
 * dev.ilmulquranus.org, previews and local development must run on Stripe
 * TEST keys only; live keys belong to the real domain alone (owner, 24 Nov
 * 2026). The plugin refused a key whose mode did not match the site mode;
 * this does the same, from the environment:
 *   NEXT_PUBLIC_SITE_ENV = "production"  → live keys required
 *   anything else (staging, preview, dev) → test keys required
 * The guard runs before any Stripe call (P2) and fails loudly instead of
 * charging a real card from staging.
 */

export type StripeMode = "test" | "live";

/** "test" / "live" from a Stripe secret, restricted or publishable key; null if it is not one. */
export function keyMode(key: string | undefined): StripeMode | null {
  const k = key?.trim() ?? "";
  const m = /^(sk|rk|pk)_(test|live)_[A-Za-z0-9]+$/.exec(k);
  return m ? (m[2] as StripeMode) : null;
}

export type StripeEnv = { siteEnv?: string; secretKey?: string; publishableKey?: string; webhookSecret?: string };

export type StripeCheck = { ok: true; mode: StripeMode } | { ok: false; reason: string };

export function checkStripeEnv(env: StripeEnv): StripeCheck {
  const expected: StripeMode = env.siteEnv === "production" ? "live" : "test";
  const secret = keyMode(env.secretKey);
  const publishable = keyMode(env.publishableKey);
  if (!secret) return { ok: false, reason: "STRIPE_SECRET_KEY is missing or not a Stripe secret/restricted key." };
  if (!/^(sk|rk)_/.test(env.secretKey!.trim())) return { ok: false, reason: "STRIPE_SECRET_KEY must be a secret (sk_) or restricted (rk_) key." };
  if (!publishable || !env.publishableKey!.trim().startsWith("pk_")) {
    return { ok: false, reason: "STRIPE_PUBLISHABLE_KEY is missing or not a publishable (pk_) key." };
  }
  if (secret !== publishable) return { ok: false, reason: `The secret key is ${secret} but the publishable key is ${publishable}.` };
  if (secret !== expected) {
    return {
      ok: false,
      reason:
        expected === "test"
          ? "Live Stripe keys are not allowed outside the production site. Use test keys on dev, previews and local."
          : "The production site needs live Stripe keys.",
    };
  }
  if (!env.webhookSecret?.trim().startsWith("whsec_")) return { ok: false, reason: "STRIPE_WEBHOOK_SECRET is missing or not a whsec_ secret." };
  return { ok: true, mode: secret };
}

/** For callers: the mode to use, or an error that stops the request. */
export function stripeModeOrThrow(env: StripeEnv = {
  siteEnv: process.env.NEXT_PUBLIC_SITE_ENV,
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
}): StripeMode {
  const result = checkStripeEnv(env);
  if (!result.ok) throw new Error(`[stripe] ${result.reason}`);
  return result.mode;
}
