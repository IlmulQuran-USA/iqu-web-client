/*
 * Marketing consent, read from cookies (owner decision 1, 24 Nov 2026: the IP
 * goes to Meta only with marketing consent, and the browser Lead fires only
 * with it). The site has no consent banner yet, so the answer is "unknown"
 * until one sets either cookie:
 *   iqu_marketing_consent = granted | denied   (this site, for a future banner)
 *   cmplz_marketing       = allow | deny       (Complianz, as on WordPress)
 * "unknown" is treated as no consent.
 */

export type Consent = "granted" | "denied" | "unknown";

export function consentFrom(get: (name: string) => string | undefined): Consent {
  const own = get("iqu_marketing_consent");
  if (own === "granted") return "granted";
  if (own === "denied") return "denied";
  const cmplz = get("cmplz_marketing");
  if (cmplz === "allow") return "granted";
  if (cmplz === "deny") return "denied";
  return "unknown";
}

/** In the browser: document.cookie. */
export function browserConsent(): Consent {
  if (typeof document === "undefined") return "unknown";
  const jar = new Map(
    document.cookie
      .split(";")
      .map((p) => p.trim().split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)] as const),
  );
  return consentFrom((name) => jar.get(name));
}
