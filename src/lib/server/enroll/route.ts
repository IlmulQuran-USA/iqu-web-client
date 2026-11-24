import type { EligibilityDetail } from "./eligibility.ts";

/*
 * Where an enrollment goes (architecture §2.1 step 10, with the live plugin
 * as the specification):
 *
 *   monthly  includes/class-iqu-enrollment.php prepare_free EN:101-139
 *            review   existing student; a coupon or a $0 fee ("help");
 *                     the email already has a family that is not canceled
 *                     ("sibling", EN:148-157); a returning student (RE:70-79)
 *            aid      a help-with-the-fee request (owner decisions 2 and 3:
 *                     reviewed, never a card before the fee is agreed)
 *            card     everyone else, when the payment step is on
 *   Summer   includes/class-iqu-summer-pay.php prepare SP:39-72
 *            summer_pay  standard fee from settings (≥ $1)
 *            review      "I need help" (help), existing student (complimentary,
 *                        reason existing_student), or an amount under $1 (amount)
 *   Weekend  free, no fee step: weekend
 *   details  an active student enrolled again (RE:85-101, decision 12)
 *
 * A location flag (monitor mode, or a flag in enforce mode) adds review
 * reasons but does not change the route: the plugin records it and lets the
 * enrollment continue (EL:231-256 sets the reason before prepare_free, which
 * routes on its own reasons only). A block never reaches this function.
 */

export type Route = "card" | "review" | "aid" | "details" | "weekend" | "summer_pay";

export type ReviewReason =
  | "location"
  | "help"
  | "aid_request"
  | "existing_student"
  | "existing_unknown"
  | "sibling"
  | "payment_setup"
  | "card_country"
  | "amount"
  | "coupon_used_up";

export type ReasonRow = { reason: ReviewReason; detail: string | null };

export type RouteInput =
  | {
      variant: "monthly";
      activeMatch: boolean;
      returning: boolean;
      existing: "yes" | "no" | "";
      aid: boolean;
      couponUsed: boolean;
      finalCents: number;
      sibling: boolean;
      freePaymentStep: boolean;
      location: EligibilityDetail[];
    }
  | { variant: "weekend"; location: EligibilityDetail[] }
  | {
      variant: "summer";
      activeMatch: boolean;
      fee: "standard" | "existing" | "help";
      feeCents: number;
      location: EligibilityDetail[];
    };

export type RouteDecision = {
  route: Route;
  /** null: keep the matched record's status (details-only update). */
  status: "pending" | "card_pending" | "pending_review" | null;
  paymentStatus: string | null;
  reasons: ReasonRow[];
};

const locationRows = (details: EligibilityDetail[]): ReasonRow[] => details.map((detail) => ({ reason: "location", detail }));

export function decideRoute(input: RouteInput): RouteDecision {
  const location = locationRows(input.location);

  if (input.variant === "weekend") return { route: "weekend", status: "pending", paymentStatus: "not_required", reasons: location };

  if (input.activeMatch) return { route: "details", status: null, paymentStatus: null, reasons: [] };

  if (input.variant === "summer") {
    if (input.fee === "existing") {
      // SP:43-46: free, flagged for the team, status unchanged.
      return { route: "review", status: "pending", paymentStatus: null, reasons: [...location, { reason: "existing_student", detail: null }] };
    }
    if (input.fee === "help") {
      return { route: "review", status: "pending_review", paymentStatus: null, reasons: [...location, { reason: "help", detail: null }] };
    }
    if (input.feeCents < 100) {
      // SP:57-63: Stripe's minimum is $0.50; under $1 the team checks it.
      return { route: "review", status: "pending_review", paymentStatus: "pending", reasons: [...location, { reason: "amount", detail: null }] };
    }
    return { route: "summer_pay", status: "pending", paymentStatus: "stripe_pending", reasons: location };
  }

  const reasons: ReasonRow[] = [];
  if (input.existing === "yes" || input.returning) reasons.push({ reason: "existing_student", detail: null });
  if (!input.freePaymentStep) {
    // Payment step off (plugin EN not run): saved as pending for the team, like the old free form.
    return { route: input.aid ? "aid" : "review", status: input.returning ? "pending_review" : "pending", paymentStatus: "pending", reasons: [...location, ...reasons] };
  }
  if (input.existing === "") reasons.push({ reason: "existing_unknown", detail: null });
  if (input.couponUsed || input.finalCents <= 0) reasons.push({ reason: "help", detail: null });
  if (input.aid) reasons.push({ reason: "aid_request", detail: null });
  if (input.sibling) reasons.push({ reason: "sibling", detail: null });

  if (reasons.length) {
    return { route: input.aid ? "aid" : "review", status: "pending_review", paymentStatus: "pending", reasons: [...location, ...reasons] };
  }
  return { route: "card", status: "card_pending", paymentStatus: "pending", reasons: location };
}
