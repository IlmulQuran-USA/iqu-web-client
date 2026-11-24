/*
 * /enroll/confirmation states (plan B3.6 with the owner's decisions of
 * 24 Nov 2026). The URL carries only the state, the IQU reference and the
 * Meta event fields: never a name, an email or a phone number.
 *
 *   card            back from Stripe after adding a card (monthly)
 *   review          the team confirms the fee (existing student, sibling, …)
 *   aid             a help-with-the-fee request
 *   details         an active student enrolled again: details updated
 *   weekend         Weekend Ilm Program
 *   summer          back from Stripe after paying the Summer fee
 *   summer-review   Summer: help with the fee, or the team checks the fee
 *   summer-existing Summer: an existing student's place
 *   card-next       saved, the next step is adding a card (monthly card route)
 *   summer-next     saved, the next step is paying the Summer fee
 *
 * "card" and "summer" are Stripe's success URLs (P2); every other state comes
 * from the server action. Until P2 connects Stripe, the card and Summer
 * payment routes end on card-next / summer-next, which say the card step is
 * not connected yet and never claim that anything was paid or confirmed.
 */

export const STATES = [
  "card",
  "review",
  "aid",
  "details",
  "weekend",
  "summer",
  "summer-review",
  "summer-existing",
  "card-next",
  "summer-next",
] as const;
export type ConfirmationState = (typeof STATES)[number];

export type Lead = { eventId: string; value: number; contentName: string };

export type Confirmation = { state: ConfirmationState; reference: string | null; lead: Lead | null };

const REF = /^IQU-\d{1,10}$/;
const EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CONTENT_NAMES = new Set([
  "Free Enrollment",
  "Summer Program Level 1",
  "Summer Program Level 2",
  "Weekend Ilm Program (New)",
  "Weekend Ilm Program (Existing)",
]);

export function confirmationHref(state: ConfirmationState, reference: string | null, lead: Lead | null): string {
  const q = new URLSearchParams({ s: state });
  if (reference && REF.test(reference)) q.set("ref", reference);
  if (lead && EVENT_ID.test(lead.eventId) && CONTENT_NAMES.has(lead.contentName)) {
    q.set("eid", lead.eventId);
    q.set("v", String(Math.round(lead.value * 100) / 100));
    q.set("cn", lead.contentName);
  }
  return `/enroll/confirmation?${q.toString()}`;
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads the URL defensively: unknown states fall back to "review", bad fields are dropped. */
export function parseConfirmation(raw: Raw): Confirmation {
  const s = one(raw.s);
  const state = (STATES as readonly string[]).includes(s) ? (s as ConfirmationState) : "review";
  const ref = one(raw.ref);
  const eid = one(raw.eid);
  const cn = one(raw.cn);
  const value = Number(one(raw.v));
  const lead =
    EVENT_ID.test(eid) && CONTENT_NAMES.has(cn) && Number.isFinite(value) && value >= 0 && value < 100_000
      ? { eventId: eid, value, contentName: cn }
      : null;
  return { state, reference: REF.test(ref) ? ref : null, lead };
}
