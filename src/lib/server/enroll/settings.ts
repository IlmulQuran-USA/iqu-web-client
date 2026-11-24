import { inArray } from "drizzle-orm";
import { settings } from "../../../db/schema.ts";
import type { Queryable } from "../../../db/types.ts";
import type { CountryMode } from "./eligibility.ts";

/*
 * Admin switches (architecture §1.2 `settings`; PLUGIN-INVENTORY §5). Each
 * key is one row, value as JSON. A missing or malformed row falls back to
 * the live plugin's current value (read 25 Nov 2026 via Novamira): country
 * check "monitor", Enroll for Free payment step "on", Summer fee $40.
 * Nothing here is hard-coded elsewhere: thresholds and amounts are read
 * from this function on every request.
 */

export type EnrollSettings = {
  countryCheck: CountryMode;
  /** "Enroll for Free payment" (plugin: On). Off: no card step, every monthly enrollment is reviewed. */
  freePaymentStep: boolean;
  /** Summer Ilm Camp standard fee in cents (plugin iqu_enroll_summer_fee). */
  summerFeeCents: number;
  /**
   * The live team chat, as an anchored regular expression (e.g. "^-1001234567890$").
   * Outside production no Telegram message may go to a chat that matches it;
   * if it is not set, staging sends no Telegram at all (fail closed).
   */
  telegramLiveChatPattern: string | null;
};

export const SETTING_KEYS = ["country_check", "free_payment_step", "summer_fee_cents", "telegram_live_chat_pattern"] as const;

export const DEFAULT_SETTINGS: EnrollSettings = {
  countryCheck: "monitor",
  freePaymentStep: true,
  summerFeeCents: 4000,
  telegramLiveChatPattern: null,
};

export function parseSettings(rows: { key: string; value: unknown }[]): EnrollSettings {
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const country = get("country_check");
  const free = get("free_payment_step");
  const fee = get("summer_fee_cents");
  const pattern = get("telegram_live_chat_pattern");
  return {
    countryCheck: country === "off" || country === "monitor" || country === "enforce" ? country : DEFAULT_SETTINGS.countryCheck,
    freePaymentStep: free === "on" || free === true ? true : free === "off" || free === false ? false : DEFAULT_SETTINGS.freePaymentStep,
    summerFeeCents:
      typeof fee === "number" && Number.isSafeInteger(fee) && fee >= 0 && fee <= 100_000 ? fee : DEFAULT_SETTINGS.summerFeeCents,
    telegramLiveChatPattern: typeof pattern === "string" && pattern.trim() && isRegex(pattern) ? pattern : null,
  };
}

function isRegex(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

export async function readSettings(db: Queryable): Promise<EnrollSettings> {
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(inArray(settings.key, [...SETTING_KEYS]));
  return parseSettings(rows);
}
