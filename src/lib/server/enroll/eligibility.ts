import { CALLING_CODES, NANP_CA, NANP_OTHER, NANP_US } from "./nanp.ts";

/*
 * US and Canada only (PLUGIN-INVENTORY §1; port of the live plugin
 * includes/class-iqu-eligibility.php v3.7.20, read 25 Nov 2026).
 *
 *   phone country    IP country   residence            result     plugin
 *   US/CA            US/CA        US/CA                allow      EL:185-222
 *   US/CA            other        US/CA                flag ip
 *   not US/CA (incl. a +1 Caribbean area code)         block phone
 *   —                —            another country      block residence
 *
 * Residence here is always an ISO code picked from a list (owner decision 14),
 * so the plugin's free-text parser and its "residence_unknown" case are not
 * needed. An unknown IP country (no Vercel header) uses the phone and
 * residence rules only, as the plugin does without GeoIP.
 *
 * Mode (settings.country_check, EL:231-256): off = nothing; monitor = keep
 * the flag as a review reason, never block (the live setting); enforce = block.
 */

export type CountryMode = "off" | "monitor" | "enforce";

/** 'US', 'CA', another ISO code, '1?' for an unassigned +1 area code, '' when unreadable (EL:94-114). */
export function phoneCountry(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (!digits || !e164.trim().startsWith("+")) return "";
  if (digits[0] === "1") {
    const npa = Number(digits.slice(1, 4));
    if (NANP_US.has(npa)) return "US";
    if (NANP_CA.has(npa)) return "CA";
    return NANP_OTHER[npa] ?? "1?";
  }
  for (const len of [3, 2, 1]) {
    const cc = CALLING_CODES[digits.slice(0, len)];
    if (cc) return cc;
  }
  return "";
}

const NORTH_AMERICA = (c: string) => c === "US" || c === "CA";

export type EligibilityDetail = "phone" | "residence" | "ip";

export type EligibilityCheck = {
  decision: "allow" | "flag" | "block";
  /** Why: one review_reasons row each (N7 keeps the detail instead of one overwriting "location"). */
  details: EligibilityDetail[];
  ipCountry: string;
  /** Where the family seems to be, for the blocked counts and the waitlist ('' when unknown). */
  country: string;
};

/** EL:185-222. `phones` are the program's E.164 numbers (monthly/weekend: WhatsApp; Summer: contact and WhatsApp). */
export function checkEligibility(input: { phones: string[]; residence: string; ipCountry: string }): EligibilityCheck {
  const ip = /^[A-Z]{2}$/.test(input.ipCountry) ? input.ipCountry : "";
  const details: EligibilityDetail[] = [];
  let phoneCc = "";
  for (const phone of input.phones) {
    if (!phone) continue;
    const pc = phoneCountry(phone);
    if (!NORTH_AMERICA(pc)) {
      phoneCc = pc;
      details.push("phone");
      break;
    }
    if (!phoneCc) phoneCc = pc;
  }
  const res = /^[A-Z]{2}$/.test(input.residence) ? input.residence : "";
  if (res && !NORTH_AMERICA(res)) details.push("residence");

  const block = details.length > 0;
  if (!block && ip && !NORTH_AMERICA(ip)) details.push("ip");

  const country = [ip, phoneCc, res].find((c) => /^[A-Z]{2}$/.test(c) && !NORTH_AMERICA(c)) ?? "";
  return { decision: block ? "block" : details.length ? "flag" : "allow", details, ipCountry: ip, country };
}

export type EligibilityOutcome =
  | { blocked: true; country: string }
  | { blocked: false; ipCountry: string; details: EligibilityDetail[] };

/** EL:231-256: the mode decides what a flag or a block does. */
export function applyEligibility(mode: CountryMode, check: EligibilityCheck): EligibilityOutcome {
  if (mode === "off") return { blocked: false, ipCountry: check.ipCountry, details: [] };
  if (check.decision === "block" && mode === "enforce") return { blocked: true, country: check.country };
  return { blocked: false, ipCountry: check.ipCountry, details: check.decision === "allow" ? [] : check.details };
}

export const BLOCK_MESSAGE =
  "We currently serve Muslim families in the United States and Canada only. When our classes open in your country, we will let you know by email.";
