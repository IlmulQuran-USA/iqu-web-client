import type { Variant } from "./params.ts";

/*
 * Browser storage keys for /enroll (owner decision 10: progress is saved on
 * the family's device only). Kept in their own module so the confirmation
 * page does not pull in the whole form.
 */

/** localStorage: the draft of one template, saved after every change. */
export const DRAFT_KEY = (variant: Variant) => `iqu-enroll:${variant}`;
/** localStorage: guardian and contact details carried into "Enroll another child". */
export const SEED_KEY = "iqu-enroll-seed";
/** sessionStorage: first name and seed for the confirmation page of this tab. */
export const LAST_KEY = "iqu-enroll-last";
