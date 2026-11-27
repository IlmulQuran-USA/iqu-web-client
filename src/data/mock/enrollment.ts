import { programs } from "../../content/pricing.ts";
import { confirmationHref } from "../../lib/enroll/confirmation.ts";
import { draftSchema } from "../../lib/enroll/draft-schema.ts";
import { stepOfField, todayIso, validateAll } from "../../lib/enroll/schema.ts";
import { isPriceError, priceMonthly } from "../../lib/server/enroll/price.ts";
import { decideRoute } from "../../lib/server/enroll/route.ts";
import { confirmationState, MESSAGES } from "../../lib/server/enroll/submit.ts";
import type { EnrollmentResult, EnrollmentWriter } from "../contracts/registrations.ts";
import { hash } from "./seed.ts";

/*
 * /enroll on dev without a database (owner, 27 Nov 2026: "/enroll continues
 * to our own confirmation on dev via the mock adapter"). The draft is checked
 * with the same rules as the live path (draftSchema, validateAll, the server
 * price, decideRoute), and the answer is the same confirmation page. Nothing
 * is saved, sent or charged. The payment step is on, so a monthly card route
 * reaches "card-next", where the page says the card step is being set up.
 * No coupon is checked, no Meta event is sent, and the reference is a mock
 * one (IQU-95xx), outside the live range.
 */
export const mockEnrollment: EnrollmentWriter = {
  async submit(rawDraft: unknown, now: Date): Promise<EnrollmentResult> {
    const parsed = draftSchema.safeParse(rawDraft);
    if (!parsed.success) return { status: "error", code: "bad_draft", message: MESSAGES.invalid };
    const draft = parsed.data;
    const problems = validateAll(draft, todayIso(now));
    if (problems) return { status: "invalid", step: problems.step, errors: problems.errors as Record<string, string>, message: MESSAGES.invalid };

    const price = draft.variant === "monthly" && draft.courseId ? priceMonthly(draft.courseId, draft.daysPerWeek, draft.feeChoice === "pay" && draft.special) : null;
    if (price && isPriceError(price)) {
      const field = price.field === "special" ? "special" : "daysPerWeek";
      return { status: "invalid", step: stepOfField(draft.variant, field), errors: { [field]: price.message }, message: price.message };
    }

    const decision =
      draft.variant === "weekend"
        ? decideRoute({ variant: "weekend", location: [] })
        : draft.variant === "summer"
          ? decideRoute({
              variant: "summer",
              activeMatch: false,
              fee: draft.summerFee === "existing" ? "existing" : draft.summerFee === "help" ? "help" : "standard",
              feeCents: programs.summer.fee * 100,
              location: [],
            })
          : decideRoute({
              variant: "monthly",
              activeMatch: false,
              returning: false,
              existing: draft.existing,
              aid: draft.feeChoice === "help",
              couponUsed: draft.feeChoice === "code",
              finalCents: price && !isPriceError(price) ? price.calculatedCents - price.specialDiscountCents : 0,
              sibling: false,
              freePaymentStep: true,
              location: [],
            });

    const reference = `IQU-${9500 + (hash(draft.submitId) % 400)}`;
    return { status: "ok", href: confirmationHref(confirmationState(draft, decision.route), reference, null), external: false };
  },
};
