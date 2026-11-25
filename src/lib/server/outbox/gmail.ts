import { randomBytes } from "node:crypto";
import type { SendResult } from "./telegram.ts";

/*
 * Gmail API mailer (owner, 24 Nov 2026: the same Gmail account as today,
 * through the Gmail API with OAuth, not Brevo). SERVER ONLY.
 *
 * Env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (scope
 * gmail.send), GMAIL_SENDER (the From address, e.g. the IQU account). Without
 * all four the adapter is idle. The refresh token is exchanged for a
 * short-lived access token, cached in memory until a minute before expiry.
 *
 * Guard outside production: mail goes ONLY to addresses in EMAIL_ALLOWLIST
 * (comma or space separated, case-insensitive). Any other recipient is
 * logged and skipped, never sent, so no family can be emailed from dev.
 */

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sender: string;
  production: boolean;
  allowlist: ReadonlySet<string>;
};

export function parseAllowlist(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)),
  );
}

export function gmailConfig(env: NodeJS.ProcessEnv): GmailConfig | null {
  const clientId = env.GMAIL_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GMAIL_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GMAIL_REFRESH_TOKEN?.trim() ?? "";
  const sender = env.GMAIL_SENDER?.trim() ?? "";
  if (!clientId || !clientSecret || !refreshToken || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) return null;
  return {
    clientId,
    clientSecret,
    refreshToken,
    sender,
    production: env.NEXT_PUBLIC_SITE_ENV === "production",
    allowlist: parseAllowlist(env.EMAIL_ALLOWLIST),
  };
}

/** Why a recipient is refused, or null when it may receive. */
export function emailRecipientRefusal(config: GmailConfig, to: string): string | null {
  if (config.production) return null;
  return config.allowlist.has(to.trim().toLowerCase()) ? null : "staging: recipient is not on EMAIL_ALLOWLIST";
}

/* ── MIME ────────────────────────────────────────────────────────────── */

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** RFC 2047 for a header with non-ASCII text (subjects with "—", names with accents). */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

/** 76-column base64 lines (RFC 2045). */
function wrap(base64: string): string {
  return base64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

export function buildMime(m: { from: string; fromName: string; to: string; subject: string; html: string; text: string; replyTo?: string }): string {
  if (/[\r\n]/.test(m.to + m.subject + m.from + m.fromName + (m.replyTo ?? ""))) throw new Error("Header injection refused");
  if (m.replyTo !== undefined && !/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(m.replyTo)) throw new Error("Reply-To is not one plain address");
  const boundary = `iqu-${randomBytes(12).toString("hex")}`;
  return [
    `From: ${encodeHeader(m.fromName)} <${m.from}>`,
    `To: ${m.to}`,
    ...(m.replyTo ? [`Reply-To: ${m.replyTo}`] : []),
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(m.text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(m.html)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/* ── Sending ─────────────────────────────────────────────────────────── */

let cached: { key: string; token: string; expiresAt: number } | null = null;

async function accessToken(config: GmailConfig, fetchImpl: typeof fetch, now: number): Promise<string> {
  const key = `${config.clientId}|${config.refreshToken.slice(-8)}`;
  if (cached && cached.key === key && cached.expiresAt > now + 60_000) return cached.token;
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OAuth token HTTP ${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("OAuth token missing in the answer");
  cached = { key, token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

/** For tests: forget the cached access token. */
export function resetGmailTokenCache(): void {
  cached = null;
}

export async function sendGmail(
  config: GmailConfig | null,
  mail: { to: string; subject: string; html: string; text: string; fromName: string; replyTo?: string },
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<SendResult> {
  if (!config) return { kind: "idle", reason: "Gmail not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER)" };
  const refusal = emailRecipientRefusal(config, mail.to);
  if (refusal) return { kind: "refused", reason: refusal };
  let raw: string;
  try {
    raw = buildMime({ from: config.sender, fromName: mail.fromName, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo });
  } catch (error) {
    return { kind: "failed", reason: (error as Error).message, retry: false };
  }
  try {
    const token = await accessToken(config, fetchImpl, now);
    const res = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { kind: "sent" };
    if (res.status === 401) cached = null; // a revoked or expired token: fetch a new one next time
    return { kind: "failed", reason: `Gmail HTTP ${res.status}`, retry: res.status === 401 || res.status === 429 || res.status >= 500 };
  } catch (error) {
    return { kind: "failed", reason: `Gmail request failed: ${(error as Error).message.slice(0, 120)}`, retry: true };
  }
}
