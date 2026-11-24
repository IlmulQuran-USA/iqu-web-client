/*
 * Telegram adapter for the outbox (architecture §3). SERVER ONLY.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. Without both the adapter is
 * idle: rows wait, nothing is sent, and the worker logs "not configured".
 *
 * Guard outside production (NEXT_PUBLIC_SITE_ENV ≠ "production"): a message
 * may go only to TELEGRAM_CHAT_ID from the environment (the test chat), and
 * never to a chat that matches the live team chat pattern stored in
 * settings.telegram_live_chat_pattern. Without that setting staging sends no
 * Telegram at all (fail closed): the live chat must be named before staging
 * can talk.
 */

export type TelegramConfig = { token: string; chatId: string; production: boolean; liveChatPattern: string | null };

export type SendResult =
  | { kind: "sent" }
  | { kind: "idle"; reason: string }
  | { kind: "refused"; reason: string }
  | { kind: "failed"; reason: string; retry: boolean };

export function telegramConfig(env: NodeJS.ProcessEnv, liveChatPattern: string | null): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? "";
  if (!token || !chatId) return null;
  return { token, chatId, production: env.NEXT_PUBLIC_SITE_ENV === "production", liveChatPattern};
}

/** Why a chat is refused, or null when it may receive. */
export function telegramChatRefusal(config: TelegramConfig, chatId: string): string | null {
  if (config.production) return null;
  if (chatId !== config.chatId) return "staging may only send to TELEGRAM_CHAT_ID (the test chat)";
  if (!config.liveChatPattern) return "staging Telegram is off until settings.telegram_live_chat_pattern names the live chat";
  let live: RegExp;
  try {
    live = new RegExp(config.liveChatPattern);
  } catch {
    return "settings.telegram_live_chat_pattern is not a valid pattern";
  }
  if (live.test(chatId)) return "TELEGRAM_CHAT_ID is the live team chat: staging must use a test chat";
  return null;
}

export async function sendTelegram(
  config: TelegramConfig | null,
  message: { chatId?: string; html: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!config) return { kind: "idle", reason: "Telegram not configured (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)" };
  const chatId = message.chatId ?? config.chatId;
  const refusal = telegramChatRefusal(config, chatId);
  if (refusal) return { kind: "refused", reason: refusal };
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message.html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { kind: "sent" };
    // 4xx other than 429 will fail the same way again (bad chat, bad markup): no retry.
    return { kind: "failed", reason: `Telegram HTTP ${res.status}`, retry: res.status === 429 || res.status >= 500 };
  } catch (error) {
    return { kind: "failed", reason: `Telegram request failed: ${(error as Error).name}`, retry: true };
  }
}
