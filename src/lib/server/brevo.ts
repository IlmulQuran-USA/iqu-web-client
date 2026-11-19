/*
 * Brevo newsletter connection. SERVER ONLY: imported by the newsletter server
 * action and the (server-rendered) footer, never by client code, so the API
 * key never reaches the browser.
 *
 * Settings come from the environment only (names in .env.example):
 *   BREVO_API_KEY           API key
 *   BREVO_LIST_ID           numeric list id the contact joins on confirmation
 *   BREVO_DOI_TEMPLATE_ID   numeric id of the double opt-in template
 *   BREVO_REDIRECT_URL      https page shown after the person confirms
 *   BREVO_API_URL           optional; defaults to Brevo's API. Only for pointing
 *                           tests at a local mock.
 * If any required setting is missing or malformed, newsletterConfig() returns
 * null and the footer shows "Sign-up opens soon." instead of a form.
 */

export type BrevoConfig = {
  apiKey: string;
  listId: number;
  templateId: number;
  redirectionUrl: string;
  apiUrl: string;
};

export function newsletterConfig(): BrevoConfig | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const listId = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  const redirectionUrl = process.env.BREVO_REDIRECT_URL?.trim();
  if (!apiKey || !redirectionUrl) return null;
  if (!Number.isInteger(listId) || listId <= 0 || !Number.isInteger(templateId) || templateId <= 0) return null;
  if (!/^https?:\/\//.test(redirectionUrl)) return null;
  return {
    apiKey,
    listId,
    templateId,
    redirectionUrl,
    apiUrl: (process.env.BREVO_API_URL?.trim() || "https://api.brevo.com/v3").replace(/\/$/, ""),
  };
}

/**
 * Sends Brevo's double opt-in email (POST /contacts/doubleOptinConfirmation).
 * "ok" covers a contact that already exists: the caller shows the same
 * message either way, so nothing reveals whether an email is on file.
 */
export async function requestDoubleOptIn(config: BrevoConfig, email: string): Promise<"ok" | "failed"> {
  try {
    const res = await fetch(`${config.apiUrl}/contacts/doubleOptinConfirmation`, {
      method: "POST",
      headers: { "api-key": config.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email,
        includeListIds: [config.listId],
        templateId: config.templateId,
        redirectionUrl: config.redirectionUrl,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "ok";
    // An address that is already a contact is not an error to the person.
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === "duplicate_parameter") return "ok";
    }
    console.error(`[newsletter] Brevo double opt-in failed with HTTP ${res.status}.`);
    return "failed";
  } catch (error) {
    console.error(`[newsletter] Brevo double opt-in request failed: ${(error as Error).name}.`);
    return "failed";
  }
}
