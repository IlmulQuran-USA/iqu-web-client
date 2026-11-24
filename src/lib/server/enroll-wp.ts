import { signedHeaders } from "./hmac.ts";

/*
 * The connection from /enroll to the iqu-registration plugin (Option A).
 * SERVER ONLY: imported by the enroll server actions and the /enroll page
 * (to know whether online enrollment is connected), never by client code.
 *
 * Settings (names in .env.example):
 *   IQU_WP_ENDPOINT        https URL of POST /wp-json/iqu/v1/enroll
 *   IQU_NEXT_HMAC_SECRET   the shared secret (same value as the plugin's)
 *   RECAPTCHA_SITE_KEY     reCAPTCHA v3 site key for the Next hosts
 *   RECAPTCHA_SECRET_KEY   reCAPTCHA v3 secret
 * The owner's rule: without the endpoint or the secret the form still works
 * and autosaves, but Review links to the live form instead of submitting.
 * Without the reCAPTCHA keys the page is treated the same way, so a request
 * is never sent unprotected.
 *
 * The plugin's sub-routes hang off the endpoint: /quote, /coupon, /waitlist.
 */

export type EnrollConfig = {
  endpoint: string;
  secret: string;
  recaptchaSiteKey: string;
  recaptchaSecret: string;
};

export function enrollConfig(): EnrollConfig | null {
  const endpoint = process.env.IQU_WP_ENDPOINT?.trim().replace(/\/$/, "") ?? "";
  const secret = process.env.IQU_NEXT_HMAC_SECRET?.trim() ?? "";
  const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY?.trim() ?? "";
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY?.trim() ?? "";
  if (!endpoint || !secret || !recaptchaSiteKey || !recaptchaSecret) return null;
  // https only, except a local mock during development.
  if (!/^https:\/\//.test(endpoint) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(endpoint)) return null;
  if (secret.length < 32) return null;
  return { endpoint, secret, recaptchaSiteKey, recaptchaSecret };
}

/** What the plugin answers (contract: enroll-plugin-changes.md, "Responses"). */
export type PluginReply = {
  ok: boolean;
  /** HTTP status of the reply; 0 when WordPress could not be reached. */
  status: number;
  code: string;
  message: string;
  errors: Record<string, string>;
  data: Record<string, unknown>;
};

const UNREACHABLE: Omit<PluginReply, "status"> = {
  ok: false,
  code: "unreachable",
  message: "",
  errors: {},
  data: {},
};

/**
 * POST a JSON body to the plugin, signed. `path` is "" for the enrollment
 * itself or "/quote", "/coupon", "/waitlist". Never throws.
 */
export async function postToPlugin(
  config: EnrollConfig,
  path: "" | "/quote" | "/coupon" | "/waitlist",
  body: unknown,
  idempotencyKey?: string,
): Promise<PluginReply> {
  const raw = JSON.stringify(body);
  try {
    const res = await fetch(`${config.endpoint}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...signedHeaders(config.secret, raw),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: raw,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      // A non-JSON answer (an HTML error page) keeps the defaults below.
    }
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const errors =
      json.errors && typeof json.errors === "object"
        ? Object.fromEntries(Object.entries(json.errors as Record<string, unknown>).map(([k, v]) => [k, str(v)]))
        : {};
    return {
      ok: res.ok && json.ok === true,
      status: res.status,
      code: str(json.code) || (res.ok ? "ok" : `http_${res.status}`),
      message: str(json.message),
      errors,
      data: json,
    };
  } catch {
    return { ...UNREACHABLE, status: 0 };
  }
}
