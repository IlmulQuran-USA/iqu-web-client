/*
 * reCAPTCHA v3, verified on the Next server (owner decision 20, 24 Nov 2026).
 * The token is checked for success, the expected action, a score of at least
 * 0.5 (the plugin's IQU_RECAPTCHA_THRESHOLD default) and the hostname of this
 * request, so a token minted on another site is refused. The plugin trusts
 * the signed request instead of checking reCAPTCHA again.
 * SERVER ONLY.
 */

// RECAPTCHA_VERIFY_URL: optional, for tests only (a local mock), like BREVO_API_URL.
const VERIFY_URL = process.env.RECAPTCHA_VERIFY_URL?.trim() || "https://www.google.com/recaptcha/api/siteverify";
export const RECAPTCHA_MIN_SCORE = 0.5;

export type RecaptchaResult = { ok: true; score: number } | { ok: false; reason: string };

export async function verifyRecaptcha(
  secret: string,
  token: string,
  action: string,
  expectedHost: string,
): Promise<RecaptchaResult> {
  if (!token || token.length > 4096) return { ok: false, reason: "missing_token" };
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as { success?: boolean; score?: number; action?: string; hostname?: string };
    if (!data.success) return { ok: false, reason: "verify_failed" };
    if (data.action !== action) return { ok: false, reason: "action_mismatch" };
    const bare = (h: string) => h.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
    if (data.hostname && expectedHost && bare(data.hostname) !== bare(expectedHost)) return { ok: false, reason: "hostname_mismatch" };
    const score = typeof data.score === "number" ? data.score : 0;
    if (score < RECAPTCHA_MIN_SCORE) return { ok: false, reason: "low_score" };
    return { ok: true, score };
  } catch {
    return { ok: false, reason: "http_error" };
  }
}
